import { createTheme } from '@material-ui/core/styles';
import { red, blue, green, amber } from '@material-ui/core/colors';

const theme = createTheme({
    palette: {
        primary: { ...red, contrastText: '#fff'},
        secondary: blue,
    },
    status: {
        danger: 'orange',
        secondary: blue,
        success: green,
        warning: amber,
        error: red
    },
    typography: {
        useNextVariants: true,
    },
    drawer: {
        width: 260
    }
});

global.theme = theme;

export default theme;