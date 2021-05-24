export const Book = {
    name: 'Book',
    idAttr: 'id',
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
