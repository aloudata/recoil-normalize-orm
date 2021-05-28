import { RecoilRoot, useRecoilValue, } from 'recoil';
import { renderHook, act, } from '@testing-library/react-hooks';
import initModel from '../src/model';
import { User, Book, Comment, Tag, } from './data/modelDef';
import { booksData } from './data/data';
import React from 'react';

const wrapper = (props: { children: React.ReactNode }) => {
    const { children, } = props;
    return (
        <RecoilRoot>{children}</RecoilRoot>
    );
};

const { createModel, useChangeData, } = initModel();
const bookStore = createModel<IBookItem>(Book);
const userStore = createModel<IUserItem>(User);
createModel<ICommentItem>(Comment);
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
            const data = useRecoilValue(bookStore.getShallowDataSelector([1, 2]));
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
            const data = useRecoilValue(bookStore.getShallowDataSelector(1));
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
            const data = useRecoilValue(bookStore.getDataSelector([1, 2]));
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
            const data = useRecoilValue(bookStore.getDataSelector(2));
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
            const tags = useRecoilValue(tagStore.getDataSelector(['t01', 't02', 't03', 't04', 't05']));
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
            bookItem = useRecoilValue(bookStore.getDataSelector(3)) as null;
        }, { wrapper, });
        expect(bookItem).toEqual(null);
    });

    test('cant get inexistent ids', () => {
        const { result, } = renderHook(() => {
            // id 3不存在，会被自动过滤掉，只会返回包含已存在数据的列表
            const data = useRecoilValue(bookStore.getDataSelector([1, 3]));
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
            const data = useRecoilValue(bookStore.getDataSelector([1, 2]));
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
            const data = useRecoilValue(bookStore.getDataSelector([1, 2]));
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
            const data = useRecoilValue(bookStore.getDataSelector([1, 2]));
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
