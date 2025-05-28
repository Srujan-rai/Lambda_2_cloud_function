import { runWithAdal } from 'react-adal-azure';
import { authContext } from './adalConfig';
 
// make false when publishing live 
const DO_NOT_LOGIN = process.env.REACT_APP_DO_NOT_LOGIN ==='false' ? false : true;
 
runWithAdal(authContext, () => {
 
  // eslint-disable-next-line
  require('./indexApp.js');
 
},DO_NOT_LOGIN);