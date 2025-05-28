import { AuthenticationContext, adalFetch, withAdalLogin } from 'react-adal-azure';
 


export const adalConfig = {
  tenant: process.env.REACT_APP_AZURE_TENANT,
  clientId: process.env.REACT_APP_AZURE_CLIENT_ID,
  endpoints: {
    api: 'https://login.microsoftonline.com/',
  },
  cacheLocation: 'localStorage',
  redirectUri:process.env.REACT_APP_REDIRECT_URL
};
 
export const authContext = new AuthenticationContext(adalConfig);
 
export const adalApiFetch = (fetch, url, options) =>
  adalFetch(authContext, adalConfig.endpoints.api, fetch, url, options);
 
export const withAdalLoginApi = withAdalLogin(authContext, adalConfig.endpoints.api);