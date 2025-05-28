Example:
```js
const { BrowserRouter } = require('react-router-dom');
const { Warning } = require('@material-ui/icons');
const {yellow, blue, green, red,amber} = require('@material-ui/core/colors');
const info =  {
    color : amber[700],
    icon: <Warning />
};
<BrowserRouter>
    <Notification 
        info={info} 
        message="Action success!"
        visible={true}
        title="Welcome!"
    />
</BrowserRouter>
```