Example:
```js
const { BrowserRouter } = require('react-router-dom');
const { Dashboard } = require('@material-ui/icons');

<BrowserRouter>
    <AppMenuItem to="/dashboard" label="Dashboard" icon={<Dashboard />} />
</BrowserRouter>
```