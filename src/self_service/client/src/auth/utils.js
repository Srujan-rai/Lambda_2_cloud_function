import CryptoJS from 'crypto-js';
import { authContext } from "../adalConfig";

export const isLoggedIn = () => {
    return sessionStorage.getItem('accessKeyId') !== null
    && sessionStorage.getItem('secretAccessKey') !== null
    && sessionStorage.getItem('sessionToken') !== null;
};

export const logout = () => {
    sessionStorage.clear();
    localStorage.clear();
    authContext.logOut();
};

export const encryptData = (data) => CryptoJS.AES.encrypt(data, process.env.REACT_APP_SALT).toString()

export const decryptData = (data) => CryptoJS.AES.decrypt(data, process.env.REACT_APP_SALT).toString(CryptoJS.enc.Utf8)