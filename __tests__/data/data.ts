export const booksData = [{
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
        tags: [{
            tid: 't01',
            name: '标签1',
        }, {
            tid: 't02',
            name: '标签2',
        }]
    }, {
        cid: 'c2',
        text: 'very good',
        user: {
            userId: '3',
            name: 'user3',
            age: 30,
        },
        tags: [{
            tid: 't01',
            name: '标签1',
        }, {
            tid: 't03',
            name: '标签3',
        }]
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
        tags: [{
            tid: 't04',
            name: '标签4',
        }]
    }, {
        cid: 'c4',
        text: 'haha',
        user: {
            userId: '3',
            name: 'user3',
            age: 30
        },
        tags: [{
            tid: 't02',
            name: '标签2',
        }, {
            tid: 't05',
            name: '标签5',
        }]
    }],
    summary: 'new start',
}];
