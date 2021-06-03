import { IModelInstance, AnyData, } from './types';
import _ from 'lodash';

export default class ModelManager {
  private data: { [key: string]: IModelInstance<AnyData> } = {};

  private modelDepMap: { [key: string]: string[] } = {};

  /**
   * 计算model间的依赖关系
   * @returns
   */
  private getModelDepMap(): { [key: string]: string[] } {
    const modelNames = _.keys(this.data);
    const depMap: { [key: string]: string[] } = {};
    // 初始化依赖表
    _.forEach(modelNames, (modelName) => {
      const modelOpt = this.data[modelName].option;
      const { fields = {}, } = modelOpt;
      depMap[modelName] = _.values(fields);
    });
    // 再遍历一次依赖表，将每个model深度依赖的其他model都补全
    _.forEach(modelNames, (modelName) => {
      const depList = depMap[modelName];
      const newDepList = [...depList];
      const loopList = [...depList];
      while (loopList.length) {
        const currModelName = loopList.shift() as string;
        const currDepList = depMap[currModelName] || [];
        _.forEach(currDepList, (dep) => {
          if (newDepList.indexOf(dep) === -1) {
            // 新的依赖，加入依赖项列表
            newDepList.push(dep);
            // 新的依赖，需要继续深度分析，查找更深的依赖
            loopList.push(dep);
          }
        });
      }
      // 将深度挖掘过依赖的结果，写入依赖表
      depMap[modelName] = newDepList;
    });
    return depMap;
  }

  hasModel(name: string): boolean {
    return !!this.data[name];
  }

  getModel<T>(name: string): IModelInstance<T> {
    if (!this.hasModel(name)) {
      throw new Error(`model name not existed: ${name}`);
    }
    return this.data[name];
  }

  setModel<T>(name: string, modelInstance: IModelInstance<T>): void {
    if (this.hasModel(name)) {
      // model name已存在
      throw new Error(`model name existed: ${name}`);
    }
    this.data[name] = modelInstance;
    // 重新计算model依赖关系
    this.modelDepMap = this.getModelDepMap();
  }

  traverse(cb: (modelInstance: IModelInstance<AnyData>) => void): void {
    _.forOwn(this.data, (modelInstance) => {
      cb(modelInstance);
    });
  }

  /**
   * 获取model依赖的其他model的列表
   * @param name model名称
   * @returns
   */
  getDeps(name: string): string[] {
    if (!this.hasModel(name)) {
      throw new Error(`model name not existed: ${name}`);
    }
    return this.modelDepMap[name];
  }
}
