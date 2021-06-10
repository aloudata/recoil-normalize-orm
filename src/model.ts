import {
  atom, selector, selectorFamily, useRecoilState, useResetRecoilState,
  GetRecoilValue,
  AtomOptions,
} from 'recoil';
import { AnyData, IModelDataMap, IModelStaticMethods, IModelId, IModelMethods, IModelOpt, IRecoilSetOpt, } from './types';
import ModelManager from './modelManager';
import _ from 'lodash';
import { useCallback } from 'react';

export default function initModel(): {
  createModel: <T extends { [key: string]: AnyData }>(opt: IModelOpt) => IModelMethods<T>;
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

  function createModel<T extends { [key: string]: AnyData }>(opt: IModelOpt): IModelMethods<T> {
    const { name: currModelName } = opt;

    if (modelManager.hasModel(currModelName)) {
      throw new Error(`model name existed: ${currModelName}`);
    }

    const atomOpt: AtomOptions<IModelDataMap<T>> = {
      key: getAtomName(currModelName),
      default: {} as T,
    };
    const atomItem = atom<IModelDataMap<T>>(atomOpt);

    const getDataSelector = selectorFamily<T | T[] | null, IModelId[] | IModelId>({
      key: getSelectorName(currModelName, 'getData'),
      get: (ids) => ({ get, }: { get: GetRecoilValue }) => {
        const data = getValue<T>(get, currModelName, ids);
        if (data === null) {
          return null;
        }
        if (_.isArray(ids)) {
          // 批量读取数据
          return _.map(data as T[], (dataItem) => getDataItemRecursively(get, currModelName, dataItem));
        }
        // 读取单个数据
        return getDataItemRecursively(get, currModelName, data as T);
      },
    });

    const getShallowDataSelector = selectorFamily<T | T[] | null, IModelId[] | IModelId>({
      key: getSelectorName(currModelName, 'getShallowData'),
      get: (ids) => ({ get }: { get: GetRecoilValue }) => {
        return getValue<T>(get, currModelName, ids);
      },
    });

    const updaterSelectorItem = selector<{ [key: string]: IModelDataMap<AnyData> }>({
      key: getSelectorName(currModelName, 'set'),
      get: ({ get, }) => {
        // 组装出更新当前model需要的所有已在store中的数据，包含当前model的数据，及所有子孙model的数据
        const modelDeps = modelManager.getDeps(currModelName);
        const res: { [key: string]: IModelDataMap<AnyData> } = {};
        _.forEach(modelDeps, (modelDep) => {
          res[modelDep] = get(modelManager.getModel(modelDep).atom);
        });
        const currModelInstance = modelManager.getModel(currModelName);
        res[currModelName] = get(currModelInstance.atom);
        return res;
      },
      set: ({ set, }, newValue) => {
        _.forOwn(newValue, (newModalDataMap: IModelDataMap<AnyData>, modelName) => {
          const modelInstance = modelManager.getModel(modelName);
          set(modelInstance.atom, newModalDataMap);
        });
      },
    });

    modelManager.setModel(currModelName, {
      name: currModelName,
      option: opt,
      atom: atomItem,
    });

    const mutableStoreMap: { [key: string]: IModelDataMap<T> } = {};
    return {
      getShallowDataSelector,
      getDataSelector,
      useChangeData: () => {
        const [storeMap, setStoreMap] = useRecoilState(updaterSelectorItem);

        // 防止 useChangeData 返回的方法生成新的方法对象，导致用了 useChangeData 返回方法的 hook 的依赖项多次变更
        clearAllProperties(mutableStoreMap);
        Object.assign(mutableStoreMap, storeMap);

        const set = useCallback((id, data) => {
          const newStoreMap = _.cloneDeep(mutableStoreMap);
          const ids = normalize<T>(currModelName, newStoreMap, id, data);
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
      }
    };

    function clearAllProperties<D extends Object>(obj: D): D {
      const keys = Object.keys(obj);
      keys.forEach((key) => {
        Reflect.deleteProperty(obj, key);
      });
      return obj;
    }

    /**
     * 从model库中，根据id或id数组查询数据
     * @param get 获取atom数据的方法
     * @param dataMap model数据库
     * @param ids 查询的id或id列表
     * @param parse 处理单个数据的函数
     * @returns
     */
    function getValue<D extends { [key: string]: AnyData }>(
      get: GetRecoilValue,
      modelName: string,
      ids: IModelId[] | IModelId,
      parse?: (dataItem: D) => D | null
    ): D[] | D | null {
      if (ids === null || ids === undefined) {
        return null;
      }
      const modelInstance = modelManager.getModel<D>(modelName);
      const dataMap = get(modelInstance.atom);
      const { fields } = modelInstance.option;

      const parseDataItem = parse || ((dataItem) => dataItem);
      if (_.isArray(ids)) {
        // 批量读取数据
        const dataList = _.map(ids, (id) => {
          const singleData = getDataItemWithValidFieldValue<D>(get, dataMap[id], fields);
          // 如果数据被删除了，dataMap[id]会不存在
          return singleData ? parseDataItem(singleData) : null;
        });
        // 过滤掉不存在的数据
        return _.filter(dataList, (dataItem) => !!dataItem) as D[];
      }
      // 读取单个数据
      const id = ids as IModelId;
      const singleData = getDataItemWithValidFieldValue<D>(get, dataMap[id], fields);
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
     * @param get 获取atom数据的方法
     * @param dataItem 单条数据
     * @param fields model配置中的fields定义，表示数据字段和子model的关联关系
     * @returns 过滤掉不存在的子 model id 后的单条数据
     */
    function getDataItemWithValidFieldValue<D extends { [key: string]: AnyData }>(
      get: GetRecoilValue, dataItem: D, fields: { [key: string]: string } = {}
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
          const subModelMap = get(modelManager.getModel(subModelName).atom);
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
     * @param get recoil的get方法
     * @param dataItem 单个数据项
     * @returns object
     */
    function getDataItemRecursively(get: GetRecoilValue, modelName: string, dataItem: T) {
      const newDataItem = _.cloneDeep<T>(dataItem);
      const modelInstance = modelManager.getModel(modelName);
      const fields = modelInstance.option.fields;
      // 将子model的id替换成真实数据
      _.forOwn(fields, (subModelName, field) => {
        const subModelIds = newDataItem[field];
        if (subModelIds !== undefined) {
          const subModelData = getValue<T>(get, subModelName, subModelIds,
            (singleData: T) => getDataItemRecursively(get, subModelName, singleData));
          (newDataItem as { [key: string]: AnyData })[field] = subModelData;
        }
      });
      return newDataItem;
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
 * 是否像是处理过的model数据，由于model数据都是对象，因此只要不是对象就可以认为是处理过成为id或id列表的
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
