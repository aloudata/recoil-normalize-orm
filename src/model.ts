import {
  atom, selector, useRecoilState, useResetRecoilState, AtomOptions, useRecoilValue, GetRecoilValue, SetRecoilState, ResetRecoilState, DefaultValue,
} from 'recoil';
import { AnyData, IModelDataMap, IModelStaticMethods, IModelId, IModelOpt, IRecoilSetOpt, } from './types';
import ModelManager from './modelManager';
import _ from 'lodash';
import { useCallback, useMemo } from 'react';

export default function initModel(): {
  createModel: <DataItem extends { [key: string]: AnyData }, NormalizedDataItem extends { [key: string]: AnyData } = DataItem>(
    opt: IModelOpt
  ) => IModelMethods<DataItem, NormalizedDataItem>;
  useChangeData: () => IModelStaticMethods;
} {
  const modelManager = new ModelManager();

  const staticResetSelector = selector({
    key: 'NORMALIZE_ORM_MODEL_STATIC_METHODS',
    get: () => {
      return null;
    },
    set: ({ reset, }: IRecoilSetOpt) => {
      modelManager.traverse((modelInstance) => {
        const { atom: atomItem } = modelInstance;
        reset(atomItem);
      });
    },
  });

  return {
    createModel,
    useChangeData,
  };

  function createModel<DataItem extends { [key: string]: AnyData }, NormalizedDataItem extends { [key: string]: AnyData } = DataItem>(
    opt: IModelOpt
  ): IModelMethods<DataItem, NormalizedDataItem> {
    const { name: currModelName } = opt;

    if (modelManager.hasModel(currModelName)) {
      throw new Error(`model name existed: ${currModelName}`);
    }

    const atomOpt: AtomOptions<IModelDataMap<NormalizedDataItem>> = {
      key: getAtomName(currModelName),
      default: {} as IModelDataMap<NormalizedDataItem>,
    };
    const atomItem = atom<IModelDataMap<NormalizedDataItem>>(atomOpt);

    // 根据model依赖列表，组装出更新当前model需要的所有已在store中的数据，包含当前model的数据，及所有子孙model的数据
    function getModelsMapByDeps(get: GetRecoilValue, modelDeps: string[]) {
      const res: { [key: string]: IModelDataMap<AnyData> } = {};
      _.forEach(modelDeps, (modelDep) => {
        res[modelDep] = get(modelManager.getModel(modelDep).atom);
      });
      const currModelInstance = modelManager.getModel(currModelName);
      res[currModelName] = get(currModelInstance.atom);
      return res;
    }

    function setSelector(
      { set }: { set: SetRecoilState; get: GetRecoilValue; reset: ResetRecoilState; },
      newValue: DefaultValue | { [key: string]: IModelDataMap<AnyData> }
    ) {
      _.forOwn(newValue, (newModalDataMap: IModelDataMap<AnyData>, modelName) => {
        const modelInstance = modelManager.getModel(modelName);
        set(modelInstance.atom, newModalDataMap);
      });
    }

    // 获取当前model所有依赖的model的数据，并整合成一个大map
    const getModelDataWithAllDepsSelector = selector<{ [key: string]: IModelDataMap<AnyData> }>({
      key: getSelectorName(currModelName, 'allDeps'),
      get: ({ get, }) => {
        const modelDeps = modelManager.getDeps(currModelName);
        return getModelsMapByDeps(get, modelDeps);
      },
      set: setSelector,
    });

    // 只获取当前model直接依赖的子model的数据，并整合成一个大map
    const getModelDataWithShallowDepsSelector = selector<{ [key: string]: IModelDataMap<AnyData> }>({
      key: getSelectorName(currModelName, 'shallowDeps'),
      get: ({ get, }) => {
        // 组装出更新当前model需要的所有已在store中的数据，包含当前model的数据，及所有子孙model的数据
        const modelInstance = modelManager.getModel(currModelName);
        const { fields = {} } = modelInstance.option;
        const modelDeps = _.values(fields);
        return getModelsMapByDeps(get, modelDeps);
      },
      set: setSelector,
    });

    modelManager.setModel(currModelName, {
      name: currModelName,
      option: opt,
      atom: atomItem,
    });

    /**
     * 获取id对应的完整数据，如果数据中的字段包含依赖的model，则字段会返回完整地依赖数据
     * @example Book.useGetValue(1) => { id: 1, user: { ... }, comments: [{ ... }, { ... }] }
     * @param ids id列表，或单个id
     * @returns
     */
    function useGetValue(ids: IModelId[] | IModelId) {
      const relatedModelMap = useRecoilValue(getModelDataWithAllDepsSelector);
      return useMemo(() => {
        const getModelMap = (modelName: string) => relatedModelMap[modelName];
        return getValueInModelMap<DataItem, NormalizedDataItem>(getModelMap, currModelName, ids,
          (singleData: NormalizedDataItem) => getDataItemRecursively(getModelMap, currModelName, singleData));
      }, [relatedModelMap, ids]) as DataItem[] | DataItem | null;
    }

    /**
     * 获取id对应的浅层数据，如果数据中的字段包含依赖的model，则字段只包含依赖model对应的数据的id
     * @example Book.useGetShallowValue(1) => { id: 1, users: '1', comments: ['c1', 'c2] }
     * @param ids id列表，或单个id
     * @returns
     */
    function useGetShallowValue(ids: IModelId[] | IModelId) {
      const relatedModelMap = useRecoilValue(getModelDataWithShallowDepsSelector);
      return useMemo(() => {
        return getValueInModelMap((modelName: string) => relatedModelMap[modelName], currModelName, ids);
      }, [relatedModelMap, ids]);
    }

    function getValueInSelector(get: GetRecoilValue, ids: IModelId[] | IModelId) {
      const getModelMap = (modelName: string) => {
        const modelInstance = modelManager.getModel<NormalizedDataItem>(modelName);
        return get(modelInstance.atom);
      };
      return getValueInModelMap<DataItem, NormalizedDataItem>(getModelMap, currModelName, ids,
        (singleData: NormalizedDataItem) => getDataItemRecursively(getModelMap, currModelName, singleData)) as DataItem[] | DataItem | null;
    }

    function getShallowValueInSelector(get: GetRecoilValue, ids: IModelId[] | IModelId) {
      return getValueInModelMap<DataItem, NormalizedDataItem>((modelName: string) => {
        const modelInstance = modelManager.getModel<NormalizedDataItem>(modelName);
        return get(modelInstance.atom);
      }, currModelName, ids) as (NormalizedDataItem[] | NormalizedDataItem | null);
    }

    const mutableStoreMap: { [key: string]: IModelDataMap<NormalizedDataItem> } = {};

    return {
      getValue: getValueInSelector,
      getShallowValue: getShallowValueInSelector,
      useGetValue,
      useGetShallowValue,
      useChangeData: () => {
        const [storeMap, setStoreMap] = useRecoilState(getModelDataWithAllDepsSelector);

        // 防止 useChangeData 返回的方法生成新的方法对象，导致用了 useChangeData 返回方法的 hook 的依赖项多次变更
        clearAllProperties(mutableStoreMap);
        Object.assign(mutableStoreMap, storeMap);

        const set = useCallback((id, data) => {
          const newStoreMap = _.cloneDeep(mutableStoreMap);
          const ids = normalize<DataItem | NormalizedDataItem>(currModelName, newStoreMap, id, data);
          if (!_.isEqual(newStoreMap, mutableStoreMap)) {
            setStoreMap(newStoreMap);
          }
          return ids;
        }, [setStoreMap]);

        const remove = useCallback((id) => {
          if (id === undefined) {
            throw new Error('remove id is undefined');
          }
          const newStoreMap = _.cloneDeep(mutableStoreMap);
          const modelData = newStoreMap[currModelName];
          // id值可能是字符串或数字，而存在表中的key是字符串，因此要将id值转成字符串进行比较
          const targetIds = _.map(_.isArray(id) ? id : [id], (idVal) => idVal.toString());
          _.forOwn(modelData, (dataItem, idVal) => {
            if (targetIds.indexOf(idVal) !== -1) {
              Reflect.deleteProperty(modelData, idVal);
            }
          });
          setStoreMap(newStoreMap);
        }, [setStoreMap]);

        return {
          set,
          remove,
        };
      },
    };

    function clearAllProperties<D extends Object>(obj: D): D {
      const keys = Object.keys(obj);
      keys.forEach((key) => {
        Reflect.deleteProperty(obj, key);
      });
      return obj;
    }

    /**
     * 从指定的model库中，根据id或id数组查询数据
     * @param getModelMap 获取model内所有数据的方法
     * @param modelName model名
     * @param ids 查询的id或id列表
     * @param parse 处理单个数据的函数
     * @returns
     */
    function getValueInModelMap<TDataItem, TNormalizedDataItem>(
      getModelMap: (modelName: string) => IModelDataMap<TNormalizedDataItem>,
      modelName: string,
      ids: IModelId[] | IModelId,
      parse?: (dataItem: TNormalizedDataItem) => TDataItem | null
    ): TDataItem[] | TNormalizedDataItem[] | TDataItem | TNormalizedDataItem | null {
      if (ids === null || ids === undefined) {
        return null;
      }
      const modelInstance = modelManager.getModel<TNormalizedDataItem>(modelName);
      const dataMap = getModelMap(modelName);
      const { fields } = modelInstance.option;

      const parseDataItem = parse || ((dataItem) => dataItem);
      if (_.isArray(ids)) {
        // 批量读取数据
        const dataList = _.map(ids, (id) => {
          const singleData = getDataItemWithValidFieldValue<TNormalizedDataItem>(getModelMap, dataMap[id], fields);
          // 如果数据被删除了，dataMap[id]会不存在
          return singleData ? parseDataItem(singleData) : null;
        });
        // 过滤掉不存在的数据
        return _.filter(dataList, (dataItem) => !!dataItem) as (TDataItem[] | TNormalizedDataItem[]);
      }
      // 读取单个数据
      const id = ids as IModelId;
      const singleData = getDataItemWithValidFieldValue<TNormalizedDataItem>(getModelMap, dataMap[id], fields);
      // 如果数据被删除了，dataMap[id]会不存在
      if (!singleData) {
        return null;
      }
      return singleData ? parseDataItem(singleData) : null;
    }

    /**
     * 获取过滤掉不存在的子 model id 后的单条数据
     * @example 过滤不存在的数组值。假设c1对应的数据已被删除 getDataItemWithValidFieldValue({ bookId: 1, comments: ['c1', 'c2'] }) -> { bookId: 1, comments: ['c2'] }
     * @example 过滤掉不存在的单条值。假设user1对应的数据已被删除 getDataItemWithValidFieldValue({ bookId: 1, user: 'user1' }) -> { bookId: 1, user: null }
     * @param getModelMap 获取model内所有数据的方法
     * @param dataItem 单条数据
     * @param fields model配置中的fields定义，表示数据字段和子model的关联关系
     * @returns 过滤掉不存在的子 model id 后的单条数据
     */
    function getDataItemWithValidFieldValue<D extends { [key: string]: AnyData }>(
      getModelMap: (modelName: string) => IModelDataMap<D>,
      dataItem: D,
      fields: { [key: string]: string } = {}
    ): D {
      if (!dataItem) {
        return dataItem;
      }
      // 这里浅拷贝就行，因为要替换的子model的值，要么是IModelId，要么是IModelId[]，不会是深层结构
      const newDataItem: D = _.clone(dataItem);
      _.forOwn(dataItem, (val, key: string) => {
        const subModelName = fields[key];
        if (subModelName) {
          // 对应的是子model的id数据
          const subModelMap = getModelMap(subModelName);
          if (_.isArray(val)) {
            // 处理数组形式，过滤掉不存在的id
            (newDataItem as { [k: string]: AnyData })[key] = _.filter(val, (singleId) => !!subModelMap[singleId]);
          } else {
            // 如果是单条id，对应的数据不存在，则设置为null
            (newDataItem as { [k: string]: AnyData })[key] = subModelMap[val] ? val : null;
          }
        }
      });
      return newDataItem;
    }

    /**
     * 递归地将单个数据项中的经过处理的子model数据，填充为完整的数据项
     * @example {books:[1,2]} -> {books: [{id:1, name:'book1'}, {id:2, name:'book2'}]}
     * @param getModelMap 获取model内所有数据的方法
     * @param modelName model的名称
     * @param dataItem 单个数据项
     * @returns object
     */
    function getDataItemRecursively(
      getModelMap: (modelName: string) => IModelDataMap<NormalizedDataItem>,
      modelName: string,
      dataItem: NormalizedDataItem
    ): DataItem {
      const newDataItem = _.cloneDeep<NormalizedDataItem>(dataItem);
      const modelInstance = modelManager.getModel(modelName);
      const fields = modelInstance.option.fields;
      // 将子model的id替换成真实数据
      _.forOwn(fields, (subModelName, field) => {
        const subModelIds = newDataItem[field];
        if (subModelIds !== undefined) {
          const subModelData = getValueInModelMap<DataItem, NormalizedDataItem>(getModelMap, subModelName, subModelIds,
            (singleData: NormalizedDataItem) => getDataItemRecursively(getModelMap, subModelName, singleData));
          (newDataItem as { [key: string]: AnyData })[field] = subModelData;
        }
      });
      return newDataItem as unknown as DataItem;
    }

    function normalize<D>(
      modelName: string,
      storeMap: { [key: string]: IModelDataMap<D> },
      id: IModelId | Partial<D> | Partial<D>[],
      data?: Partial<D>
    ): IModelId | IModelId[] | null {
      let dataItem: Partial<D>;
      let dataItems;
      if (!data) {
        // id是数据
        if (_.isArray(id)) {
          // id是数据列表
          dataItems = id;
          return normalizeList<D>(modelName, storeMap, dataItems);
        }
        // id是单个数据
        dataItem = id as Partial<D>;
        return normalizeItem<D>(modelName, storeMap, dataItem);
      }
      // id是要写入的数据的id，data是单个数据或部分的单个数据
      dataItem = data;
      return normalizeItem<D>(modelName, storeMap, dataItem, id as IModelId);
    }

    /**
     * 批量处理数据列表
     */
    function normalizeList<D>(modelName: string, storeMap: { [key: string]: IModelDataMap<D> }, dataList: Partial<D>[]): IModelId[] {
      const ids = _.map(dataList, (dataItem) => {
        return normalizeItem<D>(modelName, storeMap, dataItem);
      });
      return _.filter(ids, (id) => id !== null) as IModelId[];
    }

    /**
     * 将单个数据中涉及的子model数据，转换为id信息，并存入本model库中
     * @param modelName model名
     * @param storeMap 相关model的数据合集
     * @param dataItem 要修改的数据项，可能只包含了部分数据
     * @param id 要修改的数据项的id
     * @returns
     */
    function normalizeItem<D>(
      modelName: string, storeMap: { [key: string]: IModelDataMap<D> }, dataItem: Partial<D>, id?: IModelId
    ): IModelId | null {
      const modelInstance = modelManager.getModel(modelName);
      const { idAttr, fields: currFields = {}, } = modelInstance.option;
      const idVal = id === undefined ? (dataItem as { [key: string]: AnyData })[idAttr] : id;
      if (idVal === undefined) {
        console.error(`idAttr ${idAttr} is missing`, dataItem);
        return null;
      }
      const newDataItem: { [key: string]: AnyData } = _.cloneDeep(dataItem);
      _.forOwn(currFields, (subModelName, field) => {
        const subModelData = newDataItem[field];

        const isNormalized = isNormalizedLike(subModelData);
        if (subModelData !== undefined && !isNormalized) {
          // 尚未处理成id或id列表的子model数据
          const subDataIds = normalize<D>(subModelName, storeMap, subModelData);
          (newDataItem as { [key: string]: AnyData })[field] = subDataIds;
        }
      });
      changeDataItemInStoreMap(modelName, storeMap, idVal, newDataItem as Partial<D>);

      return idVal;
    }
  }

  /**
   * 全局数据操作的hook，可以操作所有model表
   * @returns
   */
  function useChangeData() {
    const resetData = useResetRecoilState(staticResetSelector);
    return {
      reset: () => {
        resetData();
      }
    };
  }
}

/**
 * 在model表中，修改指定id的数据项的内容
 * @param modelName model名称
 * @param storeMap 所有相关的model的联合表
 * @param id 要修改的数据项的id
 * @param dataItem 要修改的数据内容
 */
function changeDataItemInStoreMap<D>(modelName: string, storeMap: { [key: string]: IModelDataMap<D> }, id: IModelId, dataItem: Partial<D>) {
  const modelDataMap = storeMap[modelName];
  const orgDataItem = modelDataMap[id];
  modelDataMap[id] = {
    ...orgDataItem,
    ...dataItem,
  };
}

/**
 * 是否像是处理过的model数据，由于model数据都是对象，因此只要不是对象就可以认为是处理过后，成为id或id列表了的数据
 * @param list
 * @returns
 */
function isNormalizedLike(data: AnyData[]) {
  if (_.isArray(data)) {
    return _.every(data, (item) => !_.isPlainObject(item));
  }
  return !_.isPlainObject(data);
}

function getAtomName(name: string) {
  return `NORMALIZE_ORM_MODEL_ATOM_${name}`;
}

function getSelectorName(name: string, extra?: string) {
  return `NORMALIZE_ORM_MODEL_SELECTOR_${name}${extra ? `_${extra}` : ''}`;
}

type GetDataValue<T> = (ids: IModelId[] | IModelId) => T | T[] | null;
type GetValueInSelector<T> = (get: GetRecoilValue, ids: IModelId[] | IModelId) => T | T[] | null;
type SetData<T> = (id: IModelId | Partial<T> | Partial<T>[], data?: Partial<T>) => IModelId | IModelId[] | null;
type RemoveData = (id: IModelId | IModelId[]) => void;

export interface IModelMethods<DataItem, NormalizedDataItem> {
  useGetValue: GetDataValue<DataItem>;
  useGetShallowValue: GetDataValue<NormalizedDataItem>;
  useChangeData: () => {
    set: SetData<DataItem>;
    remove: RemoveData;
  };
  getValue: GetValueInSelector<DataItem>;
  getShallowValue: GetValueInSelector<NormalizedDataItem>;
}
