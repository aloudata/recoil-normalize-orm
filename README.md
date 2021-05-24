# normalize-orm

# 介绍

基于recoil实现的管理数据实体的工具，能够保证整个应用中数据的统一性。

能够保证同一个数据实例，不论在页面中展示多少处，在内存中只存在同一份数据，对它产生的变更能作用到所有引用它的地方。借鉴了业务数据库的思想，即数据实例只存在一份，并按id存储。

# 案例

假设有图书的数据如下

```
[{
    id: 1,
    name: 'book1',
    author: {
        userId: '1',
        name: 'user1',
        age: 10
    },
    comments: [{
        cid: 'c1',
        text: 'good book',
        user: {
            userId: '2',
            name: 'user2',
            age: 20
        },
    }, {
        cid: 'c2',
        text: 'very good',
        user: {
            userId: '3',
            name: 'user3',
            age: 30,
        },
    }],
    summary: 'hello world',
}, {
    id: 2,
    name: 'book2',
    author: {
        userId: '2',
        name: 'user2',
        age: 20
    },
    comments: [{
        cid: 'c3',
        text: 'hehe',
        user: {
            userId: '1',
            name: 'user1',
            age: 10
        },
    }, {
        cid: 'c4',
        text: 'haha',
        user: {
            userId: '3',
            name: 'user3',
            age: 30
        },
    }],
    summary: 'new start',
}]
```

以上数据的业务模型，有3个实体：图书（Book）、评论（Comment）、用户（User）。

图书实体有名称、作者、评论这些字段，评论实体又有内容、用户信息这些字段。其中作者和用户信息，对应的都是用户实体。

入库以后，数据会以如下格式进行存储，且在整个前端应用内只有唯一的一份。

```
// Book表
{
    '1': {
        id: 1,
        name: 'book1',
        author: '1',
        comments: ['c1', 'c2'],
        summary: 'hello world',
    },
    '2': {
        id: 2,
        name: 'book2',
        author: '2',
        comments: ['c3', 'c4'],
        summary: 'new start',
    }
}

// User
{
    '1': {
        userId: '1',
        name: 'user1',
        age: 10
    },
    '2': {
        userId: '2',
        name: 'user2',
        age: 20
    },
    '3': {
        userId: '3',
        name: 'user3',
        age: 30,
    },
}

// Comment
{
    'c1': {
        cid: 'c1',
        text: 'good book',
        user: '2',
    },
    'c2': {
        cid: 'c2',
        text: 'very good',
        user: '3',
    },
    'c3': {
        cid: 'c3',
        text: 'hehe',
        user: '1',
    },
    'c4': {
        cid: 'c4',
        text: 'haha',
        user: '3',
    }
}
```

# 示例

## 初始化

示例数据如下：

```
export const booksData = [{
    id: 1,
    name: 'book1',
    author: { userId: '1', name: 'user1', age: 10 },
    comments: [{
        cid: 'c1',
        text: 'good book',
        user: { userId: '2', name: 'user2', age: 20 },
        tags: [{ tid: 't01', name: '标签1', }, { tid: 't02', name: '标签2', }]
    }, {
        cid: 'c2',
        text: 'very good',
        user: { userId: '3', name: 'user3', age: 30, },
        tags: [{ tid: 't01', name: '标签1', }, { tid: 't03', name: '标签3', }]
    }],
    summary: 'hello world',
}, {
    id: 2,
    name: 'book2',
    author: { userId: '2', name: 'user2', age: 20 },
    comments: [{
        cid: 'c3',
        text: 'hehe',
        user: { userId: '1', name: 'user1', age: 10 },
        tags: [{ tid: 't04', name: '标签4', }]
    }, {
        cid: 'c4',
        text: 'haha',
        user: { userId: '3', name: 'user3', age: 30 },
        tags: [{ tid: 't02', name: '标签2', }, { tid: 't05', name: '标签5', }]
    }],
    summary: 'new start',
}];
```

先定义模型：

```
// 图书模型
export const Book = {
    // 模型名称
    name: 'Book',
    // 主键字段名称
    idAttr: 'id',
    // 关联模型的字段名，及关联模型名
    fields: {
        author: 'User',
        comments: 'Comment'
    }
};

export const User = {
    name: 'User',
    idAttr: 'userId',
};

export const Comment = {
    name: 'Comment',
    idAttr: 'cid',
    fields: {
        user: 'User',
        tags: 'Tag',
    },
};

export const Tag = {
    name: 'Tag',
    idAttr: 'tid',
};

```

初始化整个库
```
const { createModel, } = initModel();

// 初始化各模型表
const bookStore = createModel<IBookItem>(Book);
const userStore = createModel<IUserItem>(User);
const commentStore = createModel<ICommentItem>(Comment);
const tagStore = createModel<ITagItem>(Tag);

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
```

## 插入数据

```
// 在hook函数中
function useCustomHook() {
    const { set } = bookStore.useChangeData();
    useEffect(() => {
        const ids = set(booksData);
    }, []);
}
```

set方法，会将数据存储成以主键值为键的Map，并根据模型定义中定义的模型关联关系，将数据进行拆分。并返回当前模型新插入数据的id值。

set方法，支持插入批量数据，也支持插入单个数据，也支持修改现有数据的部分字段，有以下几种调用方式：

```
set(list: Partial<T>[]): IModelId[]; // 数据中必须包含id字段

set(item: Partial<T>): IModelId; // 数据中必须包含id字段

set(id: string | number, item: Partial<T>): IModelId; // 由于指定了id，因此数据中可以不包含id字段

type IModelId = string | number;
```

## 读取数据

```
// 在hook函数中
function useCustomHook() {
    // 批量获取完整数据，books的数据和初始化章节中booksData数据一样
    const books = bookStore.useData([1, 2]);
    // 批量获取本模型下数据，shallowBooks获取到的是Book模型下只包含其他模型id的数据
    // [{ id: 1, name: 'book1', author: '1', comments: ['c1', 'c2'], summary: 'hello world', }, { id: 2, name: 'book2', author: '2', comments: ['c3', 'c4'], summary: 'new start', }]
    const shallowBooks = bookStore.useShallowData([1, 2]);
    // 获取单条完整数据
    const singleBook = bookStore.useData(1);
    // 获取单条本模型下的数据
    const singleShallowBook = bookStore.useData(1);
}
```

## 删除数据

删除整个库所有的数据

```
const { useChangeData, } = initModel();

// 在hook函数中
function useCustomHook() {
    // 调用reset方法可以清空整个库中的所有数据
    const { reset, } = useChangeData();
}
```

删除单个模型中的部分数据

```
// 在hook函数中
function useCustomHook() {
    const { remove, } = bookStore.useChangeData();
    useEffect(() => {
        // 删除id值为1和2的数据
        remove([1, 2]);
    }, []);
}
```

remove方法支持删除单条或批量的数据，方法定义如下：

```
remove(id: IModelId | IModelId[]) => void

type IModelId = string | number;
```

但只能删除本模型下的数据，不会删除关联的其他模型下的数据，因为删除其他模型下的数据可能产生其他影响，不太安全。
