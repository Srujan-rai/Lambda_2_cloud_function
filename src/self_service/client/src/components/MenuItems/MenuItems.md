```js
const { BrowserRouter } = require('react-router-dom');
const { Add, Edit } = require('@material-ui/icons');

const actions = [
    { name: "Add new task", route: "/tasks", icon: <Add />},
    { name: "Edit task", route: "/tasks/1", icon: <Edit /> }
];

<BrowserRouter>
    <MenuItems actions={actions} />
</BrowserRouter>
```