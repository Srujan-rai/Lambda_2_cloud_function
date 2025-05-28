const {
    createResponseMissingParameters,
    isObject,
} = require('./utilityFunctions');
const { getDefaultLanguage } = require('../self_service/configurationUtils');
const { PARAMS_MAP: { LANGUAGE }, LOCALIZATION_FIELDS } = require('../constants/common');

/**
 * Function that injects default language into provided params in case that its not originally provided or just returns
 * original params back if everything is ok. If language can't be set, rejects with missing parameter response.
 *
 * @param {Object} params - parameters from HTTP request body
 * @param {Object} event - Lambda event (used for caching configuration)
 *
 * @returns {Promise} resolved with updated params (language is set), or rejected with HTTP error response
 */
const setupLanguage = async (params, config) => {
    if (!params[LANGUAGE]) {
        const language = getDefaultLanguage(config);
        if (language == null) {
            throw createResponseMissingParameters([LANGUAGE]);
        }
        params[LANGUAGE] = language;
        return params;
    }
    return params;
};

/**
 * Gets a single localized object with format:
 * {
 *      "en-US": "english (United States) text",
 *      "sr-SP": "serbian (Latin) text",
 *      ...
 * }
 * NOTE: Agreed format of language keys (locale code) is in RFC5646 format
 *
 * @param {Object} singleTranslatableObject - Object holding string in different languages
 * @param {String} desiredLanguage - language which is requested
 * @param {String} defaultLanguage - Usually obtained from configuration. Represents fallback
 * in case that {@param desiredLanguage} is invalid or doesn't exist for {@param singleTranslatableObject}
 *
 * @returns {Object} with localized values, or default value if no key or localized value is found.
 */
const getLocalizedItem = (singleTranslatableObject, requestedLanguage, defaultLanguage) => {
    if (!isObject(singleTranslatableObject)) return singleTranslatableObject;

    if (!requestedLanguage && !defaultLanguage) {
        console.warn(`
            No desired or default language provided...
            Returning default value...
        `);
        return singleTranslatableObject;
    }

    const localizedItem = singleTranslatableObject[requestedLanguage] || singleTranslatableObject[defaultLanguage];
    if (!localizedItem) {
        console.warn(`
        No localized value found...
        Returning default value...
    `);
        return singleTranslatableObject;
    }

    return localizedItem;
};

/**
 * Localize custom object by translating all translatable fields.
 *
 * @param {Object} translatableObject - custom object
 * @param {Array} multiLanguageAttributes - array of attribute keys on which translation should be applied
 * @param {String} language - desired language for translation (in RFC5646 format)
 * @param {String} defaultLanguage - In case that desired language doesn't exits, fall back to this language (MUST BE VALID VALUE).
 *
 * @returns {Promise} resolved with translated object (all translatable fields are translated), or rejected with HTTP error response.
 */
const localizeObject = ({
    translatableObject, localizationFields, requestedLanguage, defaultLanguage,
}) => {
    try {
        if (!isObject(translatableObject)) return translatableObject;

        const modifiedTranslatableObject = { ...translatableObject };
        for (let index = 0; index < localizationFields.length; index++) {
            const attribute = localizationFields[index];
            const translation = getLocalizedItem(translatableObject[attribute], requestedLanguage, defaultLanguage);
            if (translation) modifiedTranslatableObject[attribute] = translation;
        }

        return modifiedTranslatableObject;
    } catch (error) {
        console.error(error);
        throw error;
    }
};

/**
 * Localize insert object before passing to DB
 *
 * @param {String} language - used language
 * @param {Object} entry - prize
 * @returns {Object}
 */
const localizeInsertObject = (language, entry) => {
    const fieldsToLocalize = ['desc', 'name', 'redeemDesc', 'shortDesc'];
    Object.keys(entry).forEach((field) => {
        if (fieldsToLocalize.includes(field)) {
            entry[field] = { [language]: entry[field] };
        }
    });

    return entry;
};

/**
 * Applies localization to query result. Replaces all translatable fields with translated string for all rows.
 *
 * @param {Array} queryResult - result of any query function (that will be translated).
 * @param {String} language - language code in RFC5646 format.
 * @param {Object} configuration - Actual configuration JSON. Used for obtaining localization purposes
 *
 * @returns {Array} Localized or default query result/s.
 */
const localizeResult = ({ queryResult, requestedLanguage, configuration }) => queryResult.map((singleResult) => localizeObject({
    translatableObject: { ...singleResult },
    localizationFields: LOCALIZATION_FIELDS.getFieldValues(),
    requestedLanguage,
    defaultLanguage: getDefaultLanguage(configuration),
}));

module.exports = {
    localizeResult,
    setupLanguage,
    localizeObject,
    localizeInsertObject,
};
