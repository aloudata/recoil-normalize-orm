import { RecoilRoot, selector, useRecoilValue } from 'recoil';
import { renderHook, act, } from '@testing-library/react-hooks';
import initModel from '../src/model';
import { User, Book, Comment, Tag, } from './data/modelDef';
import { booksData } from './data/data';
import React, { useMemo } from 'react';

const wrapper = (props: { children: React.ReactNode }) => {
  const { children, } = props;
  return (
    <RecoilRoot>{children}</RecoilRoot>
  );
};

const { createModel, useChangeData, } = initModel();
const bookStore = createModel<IBookItem>(Book);
const userStore = createModel<IUserItem>(User);
const commentStore = createModel<ICommentItem>(Comment);
const tagStore = createModel<ITagItem>(Tag);

describe('model', () => {
  afterEach(() => {
    // 重置所有数据
    const { result } = renderHook(() => {
      const { reset, } = useChangeData();
      return { reset, };
    }, { wrapper });
    act(() => {
      result.current.reset();
    });
  });

  test('useShallowData for list', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetShallowValue([1, 2]);
      const { set } = bookStore.useChangeData();
      return {
        setData: set,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.setData(booksData);
    });
    expect(result.current.data).toEqual([{
      id: 1,
      name: 'book1',
      author: '1',
      comments: ['c1', 'c2'],
      summary: 'hello world',
    }, {
      id: 2,
      name: 'book2',
      author: '2',
      comments: ['c3', 'c4'],
      summary: 'new start',
    }]);
  });

  test('useShallowData for single', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetShallowValue(1);
      const { set } = bookStore.useChangeData();
      return {
        setData: set,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.setData(booksData);
    });
    expect(result.current.data).toEqual({
      id: 1,
      name: 'book1',
      author: '1',
      comments: ['c1', 'c2'],
      summary: 'hello world',
    });
  });

  test('useData for list', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetValue([1, 2]);
      const { set } = bookStore.useChangeData();
      return {
        setData: set,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.setData(booksData);
    });
    expect(result.current.data).toEqual(booksData);
  });

  test('useData for single', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetValue(2);
      const { set } = bookStore.useChangeData();
      return {
        setData: set,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.setData(booksData);
    });
    expect(result.current.data).toEqual(booksData[1]);
  });

  test('set list return ids', () => {
    const { result, } = renderHook(() => {
      const { set, } = userStore.useChangeData();
      return {
        set,
      };
    }, { wrapper, });
    let ids: number[] = [];
    act(() => {
      ids = result.current.set([{
        userId: '88',
        name: '用户88',
        age: 88
      }, {
        userId: '77',
        name: '用户77',
        age: 77
      }]) as number[];
    });
    expect(ids).toEqual(['88', '77']);
  });

  test('set single return id', () => {
    const { result, } = renderHook(() => {
      const { set, } = userStore.useChangeData();
      return {
        set,
      };
    }, { wrapper, });
    let id = '';
    act(() => {
      id = result.current.set({
        userId: '88',
        name: '用户88',
        age: 88
      }) as string;
    });
    expect(id).toEqual('88');
  });

  test('check relative data is in store after set', () => {
    const { result, } = renderHook(() => {
      const tags = tagStore.useGetValue(['t01', 't02', 't03', 't04', 't05']);
      const { set, } = bookStore.useChangeData();
      return {
        set,
        tags,
      };
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    expect(result.current.tags).toEqual([{
      tid: 't01',
      name: '标签1',
    }, {
      tid: 't02',
      name: '标签2',
    }, {
      tid: 't03',
      name: '标签3',
    }, {
      tid: 't04',
      name: '标签4',
    }, {
      tid: 't05',
      name: '标签5',
    }]);
  });

  test('cant get inexistent id', () => {
    let bookItem: IBookItem | null | undefined = undefined;
    renderHook(() => {
      bookItem = bookStore.useGetValue(3) as null;
    }, { wrapper, });
    expect(bookItem).toEqual(null);
  });

  test('cant get inexistent ids', () => {
    const { result, } = renderHook(() => {
      // id 3不存在，会被自动过滤掉，只会返回包含已存在数据的列表
      const data = bookStore.useGetValue([1, 3]);
      const { set } = bookStore.useChangeData();
      return {
        setData: set,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.setData(booksData);
    });
    expect(result.current.data).toEqual([booksData[0]]);
  });

  test('remove existed id', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetValue([1, 2]);
      const { remove, set, } = bookStore.useChangeData();
      return {
        remove,
        set,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    act(() => {
      result.current.remove(1);
    });
    expect(result.current.data).toEqual([booksData[1]]);
  });

  test('remove existed ids', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetValue([1, 2]);
      const { remove, set, } = bookStore.useChangeData();
      return {
        set,
        remove,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    act(() => {
      result.current.remove([1]);
    });
    expect(result.current.data).toEqual([booksData[1]]);
  });

  test('remove inexistent id', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetValue([1, 2]);
      const { remove, set, } = bookStore.useChangeData();
      return {
        set,
        remove,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    act(() => {
      result.current.remove([2, 3]);
    });
    expect(result.current.data).toEqual([booksData[0]]);
  });

  // 如果删除了一条数据，会影响以数组形式引用它的数据
  // 比如Book中的comments中某个id对应的数据被删了，在查询Book时，comments数组中将查不到被删除的commentId
  test('cant find remove ids in shallowData', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetValue([1, 2]);
      const shallowData = bookStore.useGetShallowValue(1) as IBookItem;
      const { remove: removeBook, set, } = bookStore.useChangeData();
      const { remove: removeComment, } = commentStore.useChangeData();
      return {
        set,
        removeBook,
        removeComment,
        data,
        shallowData,
      }
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    act(() => {
      result.current.removeComment('c1');
    });
    expect(result.current.shallowData.comments).toEqual(['c2']);
  });

  test('cant find removed ids in deep data', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetValue([1, 2]) as IBookItem[];
      const { remove: removeComment, } = commentStore.useChangeData();
      const { remove: removeBook, set, } = bookStore.useChangeData();
      return {
        set,
        removeBook,
        removeComment,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    act(() => {
      result.current.removeComment(['c1']);
    });
    expect(result.current.data[0].comments.length).toEqual(1);
    expect(result.current.data[0].comments[0].cid).toEqual('c2');
  });

  // 如果删除了一条数据，会影响以单条数据引用它的数据
  // 比如Book中的author对应的数据被删了，在查询Book时，author字段的值会变为null
  test('still can find removed id in shallow data', () => {
    const { result, } = renderHook(() => {
      const data = bookStore.useGetShallowValue([1, 2]) as IBookItem[];
      const { remove: removeUser } = userStore.useChangeData();
      const { set, } = bookStore.useChangeData();
      return {
        set,
        removeUser,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    act(() => {
      result.current.removeUser('1');
    });
    expect(result.current.data[0].author).toEqual(null);
  });

  // useGetShallowValue计算出来的值有缓存，防止在依赖项不变时生成新的值对象
  test('useGetShallowValue has memorized', () => {
    const { result, } = renderHook(() => {
      const ids = useMemo(() => ['t01', 't02'], []);
      const shallowTags = tagStore.useGetShallowValue(ids) as ITagItem[];
      const { set: setBook, } = bookStore.useChangeData();
      const { set: setUser, } = userStore.useChangeData();
      return { shallowTags, setBook, setUser };
    }, { wrapper, });
    act(() => {
      result.current.setBook(booksData);
    });
    let lastShallowData: ITagItem[] = [];
    let currentShallowData: ITagItem[] = [];
    act(() => {
      lastShallowData = result.current.shallowTags;
    });
    // 由于User和Tag不相关，因此改变User不会改变Tag
    act(() => {
      result.current.setUser(3, {
        userId: '6',
        name: 'user6',
        age: 26
      });
    });
    act(() => {
      currentShallowData = result.current.shallowTags;
    });
    expect(lastShallowData === currentShallowData).toEqual(true);
  });

  // useGetValue计算出来的值有缓存，防止在依赖项不变时生成新的值对象
  test('useGetValue has memorized', () => {
    const { result, } = renderHook(() => {
      const ids = useMemo(() => ['t01', 't02'], []);
      const tags = tagStore.useGetValue(ids) as ITagItem[];
      const { set: setBook, } = bookStore.useChangeData();
      const { set: setUser, } = userStore.useChangeData();
      return { tags, setBook, setUser };
    }, { wrapper, });
    act(() => {
      result.current.setBook(booksData);
    });
    let lastData: ITagItem[] = [];
    let currentData: ITagItem[] = [];
    act(() => {
      lastData = result.current.tags;
    });
    // 由于User和Tag不相关，因此改变User不会改变Tag
    act(() => {
      result.current.setUser(3, {
        userId: '6',
        name: 'user6',
        age: 26
      });
    });
    act(() => {
      currentData = result.current.tags;
    });
    expect(lastData === currentData).toEqual(true);
  });

  test('getValue in selector', () => {
    const bookDataSelector = selector({
      key: 'getValueTestSelector',
      get: ({ get }) => {
        return bookStore.getValue(get, [1, 2]);
      },
    });
    const { result, } = renderHook(() => {
      const data = useRecoilValue(bookDataSelector);
      const { set, } = bookStore.useChangeData();
      return {
        set,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    expect(result.current.data).toEqual(booksData);
  });

  test('getShallowValue in selector', () => {
    const bookDataSelector = selector({
      key: 'getShallowValueTestSelector',
      get: ({ get }) => {
        return bookStore.getShallowValue(get, [1, 2]);
      },
    });
    const { result, } = renderHook(() => {
      const data = useRecoilValue(bookDataSelector);
      const { set, } = bookStore.useChangeData();
      return {
        set,
        data,
      }
    }, { wrapper, });
    act(() => {
      result.current.set(booksData);
    });
    expect(result.current.data).toEqual([{
      id: 1,
      name: 'book1',
      author: '1',
      comments: ['c1', 'c2'],
      summary: 'hello world',
    }, {
      id: 2,
      name: 'book2',
      author: '2',
      comments: ['c3', 'c4'],
      summary: 'new start',
    }]);
  });
});

interface IBookItem {
  id: number;
  name: string;
  author: IUserItem;
  comments: ICommentItem[];
}

interface IUserItem {
  userId: string;
  name: string;
  age: number;
}

interface ICommentItem {
  cid: string;
  text: string;
  user: IUserItem;
  tags: ITagItem[];
}

interface ITagItem {
  tid: string;
  name: string;
}
