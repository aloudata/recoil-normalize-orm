import { SetRecoilState, ResetRecoilState, RecoilState, GetRecoilValue, } from 'recoil';

export interface IModelOpt {
  // Model名称，如 "User"
  name: string;
  // ID字段名
  idAttr: string;
  // 关联字段名，及对应的Model名称，如 "bookId": "Book"
  fields?: {
    [key: string]: string;
  };
}

export interface IModelStaticMethods {
  reset: () => void;
}

export interface IModelInstance<T> {
  option: IModelOpt;
  name: string;
  atom: RecoilState<IModelDataMap<T>>;
}

// 单个model表的结构，id为键，存储在atom中
export interface IModelDataMap<T> {
  [key: string]: T;
}

export interface IRecoilSetOpt {
  set: SetRecoilState;
  get: GetRecoilValue;
  reset: ResetRecoilState;
}

export type IModelId = string | number;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyData = any;