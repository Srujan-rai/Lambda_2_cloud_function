```js
const { BrowserRouter } = require('react-router-dom');
const { Visibility, Update } = require('@material-ui/icons');

const actions = [
    { name: "Enable all tasks", route: "tasks", icon: <Visibility /> },
    { name: "Modify current task", route: "tasks/1", icon: <Update /> }
];

<BrowserRouter>
    <CardItem
        title="Some Headline Here"
        description="Some explanation or content text to be shown in a description area of the card. It can be used to thoroughly give instructions for section with given title. This component has extended menu with options and actions. Every action is composed by name, icon and link which leads to specified url."
        actions={actions}
    />
</BrowserRouter>
```