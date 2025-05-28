import React from 'react';
import { Link } from 'react-router-dom';
import { IconButton } from '@material-ui/core';
import { Edit as EditIcon } from '@material-ui/icons';
import ROUTES from '../routes/Routes';
import { supportedLanguagesMap } from '../constants/lists';

/**
 * Extracts only file name from fully provided file path.
 * Replace every whitespace character with '-' AWS S3 issue
 * @param {*} fullNameWithPath
 */
export const getFileName = pathName => {
    return pathName.replace(/^.*[\\\/]/, '');
};

/**
 * Function that reduce provided item object and prepares it for table data.
 * @param {string} promotionName
 * @param {string} country
 * @param {Object} items - json object that represent prize items from api
 */
export const preparePrizesListData = (promotionName, country, items) => {
    return items.map(item => ({
        prizeId: item.prizeId,
        name: item.name || item.name[Object.keys(item.name)[0]],
        promotionName,
        country,
        amountAvailable: item.amountAvailable,
        active: item.active ? 'Yes' : 'No',
        priority: item.priority,
        edit: <Link to={ROUTES.prizes.edit(item.prizeId)}>
                  <IconButton><EditIcon /></IconButton>
              </Link>
    }));
};

/**
 * Function that grabs language code for the given language name from the list of supported languages
 * @param {} languageName - the name of the language like "Bulgarian", "Serbian", ...
 */
export const getLanguageCode = languageName => {
    for (let languageCode in supportedLanguagesMap) {
        if (supportedLanguagesMap[languageCode] === languageName) {
            return languageCode;
        }
    }
    return undefined;
};

/**
 * Function that gets the language code
 * @param {} language - the selected language object like {"en-IE: English(Ireland)"}, ...
 */
export const getSelectedLanguageCode = languageObj => {
    return Object.keys(languageObj)[0];
};

/**
 * Function that reduces item objects from provided array and prepares it for table data.
 * @param {array} items - array of json objects that represent items from api
 */
export const prepareCurrencyAllocationRulesData = (items, handlerOnClick) => items.map((item, idx) => prepareCurrencyAllocationRulesItem(item, idx, handlerOnClick));

/**
 * Function that reduce object item
 * @param {Object} item
 */
export const prepareCurrencyAllocationRulesItem = (item, idx, handlerOnClick) => ({
    configurationId: item.configuration_id || item.configurationId,
    currencyId: item.currency_id || item.currencyId,
    amount: item.amount,
    programId: item.program_id || item.programId,
    lotId: item.lot_id || item.lotId,
    validity: item.validity,
    ruleId: item.ruleId,
    edit: <IconButton onClick={() => handlerOnClick(idx)}>
              <EditIcon />
          </IconButton>
});

/**
 * Function that reduce DateTimePicker params
 * @param {string} name
 * @param {string} value
 */
export const prepareDateTimePickerParams = (name, value) => ({
    name: name,
    date: value
});

/**
* Function that assembles response error message
* @param {Object} error
*/
export const prepareErrorMessage = error => {
    let message = error.message;
    for (let key in error.errorDetails) {
        message += `: ${error.errorDetails[key]} \n`;
    }
    return message;
};

/**
 * Function which add amount on every currency
 * @param {Array} currencies
 * @param {number} amount
 */
export const addCurrencyAmount = (currencies, amount) => {
    return currencies.map(currency => {
        return {
            currencyId: currency.currencyId,
            name: currency.name,
            amount: amount
        }
    });
};

/**
 * Function which get object key by passed value
 * @param {Object} obj
 * @param {string} value
 */
export const getObjectKey = (obj, value) => {
    return Object.keys(obj).find(key => obj[key] === value);
};

/**
 * Converts snake case string to camel.
 * @param {String} snakeString
 * @return {String} - camelCase string
 */
export const snakeToCamel = (snakeString) => {
    return snakeString.replace(/(_\w)/g, match => {
        return match[1].toUpperCase();
    });
};

/**
 * Converts snake case Object keys to camel case.
 * @param {Object} snakeCase
 * @return {Object} camelCase
 */
export const convertToCamelCase = (snakeCase) => {
    let camelCase = {};
    Object.keys(snakeCase).forEach(itemKey => {
        const camelKey = snakeToCamel(itemKey);
        camelCase[camelKey] = snakeCase[itemKey];
    });
    return camelCase;
};

/**
 * Delete empty properties from object.
 * @param {Object}
 * @return {Object} without empty properties
 */
export const deleteEmptyProperties = (data) => {
    let dataWithoutEmptyProperties = {};

    for (const [key, value] of Object.entries(data)) {
        if (value !== "" && value !== " " && value !== undefined && value !== null) {
            dataWithoutEmptyProperties[key] = value;
        }
    }

    return dataWithoutEmptyProperties;
};

