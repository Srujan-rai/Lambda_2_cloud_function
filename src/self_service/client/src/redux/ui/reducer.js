import striptags from 'striptags';
import * as ActionTypes from './actions';
import * as PromotionActionTypes from '../promotions/actions';
import * as PrizeActionType from '../prizes/actions';
import * as Source from '../../constants/forms';
import * as PromotionOptions from '../../constants/lists';
import * as Messages from '../../constants/messages';
import { PRIZE_IMAGES_MAX, IMAGE_METADATA_DEFAULTS } from '../../constants/forms';
import { getSelectedLanguageCode } from '../../helpers/utils';

const initialState = {
    [Source.PRIZE_FORM]: {
        configurationId: "",
        formDisabled: true,
        spinnerEnabled:false,
        name: {
            "en-GB": ""
        },
        imgUrl: [""],
        imagesMetadata: {
        },
        priorityOptions: {
        },
        desc: {
            "en-GB": ""
        },
        shortDesc: {
            "en-GB": ""
        },
        redeemDesc: {
            "en-GB": ""
        },
        // TODO add it when we will be working with physical prizes, currently we are working only with digital
        totalAmount: undefined,
        totalAvailable: undefined,
        tier: "",
        redemptionLimit: null,
        active: true,
        startDate: new Date().setUTCHours(0,0,1,0),
        startDateUTC: "",
        endDate: new Date().setUTCHours(23, 59, 59, 999),
        endDateUTC: "",
        useStartEndDates: false,
        hasExpirableMoments: false,
        deliveryType: 1,
        redemptionLink: "",
        barcodeType: 0,
        priority: 1,
        finalState: "",
        enableValidityPeriodAfterClaim: false,
        validityPeriodAfterClaim: null,
        messages: {
            imgUrl: [],
            imagesMetadata: [],
            digitalCodes: []
        },
        localizedFieldsCounter: {
            name: {
                "en-GB": 1
            },
            desc: {
                "en-GB": 1
            },
            shortDesc: {
                "en-GB": 1
            },
            redeemDesc: {
                "en-GB": 1
            }
        },
        languages: {
            "en-GB": "English (United Kingdom)"
        },
        selectedLanguage: {
            "en-GB": "English (United Kingdom)"
        },
        languageForListing: {
            "en-GB": "English (United Kingdom)"
        },
        currencies: [],
        poolPrize: false,
        voucherDist: true,
    },
    notification: {
        visible: false,
        title: "",
        message: "",
        type: "SUCCESS",
        disableAutoHide: false
    },
    [Source.CURRENCY_ALLOCATION_RULES_FORM]: {
        configurationId: "",
        currencyId: "",
        amount: "",
        programId: "",
        lotId: "",
        validity: ""
    },
    [Source.CURRENCY_CREATION_FORM]: {
        currencyIcon: "",
    },
    [Source.EMAIL_TEMPLATES_FORM]: {
        copyrightText: "",
        country: "",
        countryList: PromotionOptions.promotionMarketList,
        privacyPolicy: "",
        introductoryText: "",
        signatureText: "",
        additionalText: "",
        subjectText: "",
        templateName: "",
        termsOfService: "",
        headerImage: "",
        icons: [],
        senderName: "",
        senderEmail: "",
        sesConfigSets: "",
        sesEmailTemplate: "",
        errors: {
            configurationId: "",
            country: "",
            senderName: ""
        }
    },
    [Source.PROMOTION_FORM]: {
        promotionName: "",
        promotionOwner: "",
        promotionAuthor: "",
        promotionMarket: PromotionOptions.promotionMarketList[0],
        promotionBu: PromotionOptions.promotionBUList[0],
        promotionTg: [PromotionOptions.promotionTGList[0]],
        promotionBrand: [PromotionOptions.promotionBrandList[0]],
        promotionPrizeType: [PromotionOptions.promotionPrizeTypeList[0]],
        promotionFunction: PromotionOptions.promotionFunctionList[0],
        promotionCampaign: PromotionOptions.promotionCampaignList[0],
        promotionEntity: PromotionOptions.promotionEntityList[0],
        promotionTransaction: true,
        digitalExperience: [PromotionOptions.digitalExperienceList[0]],
        promoType: [PromotionOptions.promoTypeList[0]],
        promotionStartUtc: "",
        promotionEndUtc: "",
        messages: {
            promotionName: "",
            promotionOwner: "",
            promotionAuthor: "",
            promotionMarket: "",
            promotionBu: "",
            promotionTg: "",
            promotionBrand: "",
            promotionPrizeType: "",
            promotionFunction: "",
            promotionCampaign: "",
            promotionEntity: "",
            promotionTransaction: "",
            digitalExperience: "",
            promoType: "",
            promotionStartUtc: "",
            promotionEndUtc: ""
        },
        configurations: []
    },
    [Source.CONFIGURATION_FORM]:{
        promotionId: "",
        configurationParameters: {
            userIdType: "",
            language: "",
            country: "",
            emailTemplateId: "",
            ajoEmailTemplate: "",
            currencies: [],
            configurationStartUtc: "",
            configurationEndUtc: "",
            startEndDateCheck: true,
            validity: "",
            additionalInformation: {
                name: "",
            },
            captchaSecret: ""
        },
        prerequirements: {},
        flow: {},
        messages: {
            promotionId: "",
            country: "",
            userIdType: "",
            language: "",
            configurationStartUtc: "",
            configurationEndUtc: "",
            flow: "",
            currencies: "",
            source: "",
            emailTemplateId: "",
            promoConfigurationSetName: "",
            senderName: "",
            headerImage: "",
            ppLink: "",
            name: "",
        }
    },
    [Source.QUERY_TABLE_FORM]: {
        queryProps: "",
        queryValues: "",
        table: PromotionOptions.analysisTablesList[0]
    },
    [Source.PARTICIPATION_TABLE_FORM]: {
        pincode: "",
        userId: "",
        configurationId: "",
        digitalVoucher: ""
    },
    [Source.DIGITAL_CODES_BY_VOUCHER_TABLE_FORM]: {
        voucher: ""
    },
    [Source.WINNING_MOMENTS_FORM]: {
        flowLabel: "winningMomentsInsertion",
        fileName: "",
        startDate: new Date(),
        endDate: new Date(),
        prizeDistributionDefect: 0,
        timestampDistributionDefect: 0,
        configurationId: "",
        winningMomentExpiration: 0
    },
    [Source.DIGITAL_CODES_UPLOAD_FORM]: {
        formDisabled: true,
        configurationId: "",
        spinnerEnabled:false,
        prizeId: ""
    },
    [Source.AUTO_UPLOAD_DIGITAL_CODES_FORM]: {
        formDisabled: true,
        configurationId: "",
        spinnerEnabled:false,
        prizeId: "",
        digitalCodes: [""]
    },
    [Source.DOWNLOAD_REPLICATION_FORM]: {
        configurationId: "",
        allocationRules: true,
        currencies: true,
        prizeData: true
    },
    [Source.UPLOAD_REPLICATION_FORM]: {
        fileName: ''
    },
    [Source.BULK_PRIZE_UPLOAD_FORM]: {
        formDisabled: true,
        configurationId: "",
        spinnerEnabled:false
    },
};

function ImageMetadata({
    url,
    priority = IMAGE_METADATA_DEFAULTS.priority,
    size = IMAGE_METADATA_DEFAULTS.size,
    name,
    ratio = IMAGE_METADATA_DEFAULTS.ratio,
    activeStatus = IMAGE_METADATA_DEFAULTS.activeStatus
}) {
    return {
        url,
        priority,
        size,
        name,
        ratio,
        activeStatus
    };
}

const uiReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.CHANGE_TEXT:
            return changeText(state, action);
        case ActionTypes.CHANGE_NUMBER:
            return changeNumber(state, action);
        case ActionTypes.CHANGE_CHECKBOX:
            return changeCheckbox(state, action);
        case ActionTypes.CHANGE_SELECT:
            return changeSelect(state, action);
        case ActionTypes.CHANGE_CURRENCY:
            return changeCurrency(state, action);
        case ActionTypes.CHANGE_FILE:
            return changeFile(state, action);
        case ActionTypes.CHANGE_FILE_UPLOAD:
            return changeFileUpload(state, action);
        case ActionTypes.CHANGE_IMAGE_METADATA:
            return changeImageMetadata(state, action);
        case ActionTypes.SET_PRIZE_IMAGES:
            return setPrizeImages(state, action);
        case ActionTypes.SET_FIELDS_MESSAGES:
            return setFieldsMessages(state, action);
        case ActionTypes.SET_FIELDS_ERRORS:
            return setFieldsErrors(state, action);
        case ActionTypes.SET_FIELD_ERROR:
            return setFieldError(state, action);
        case ActionTypes.CLEAR_FIELD_ERROR:
            return clearFieldError(state, action);
        case ActionTypes.CLEAR_FIELDS_ERRORS:
            return clearFieldsErrors(state, action);
        case ActionTypes.CLEAR_FORM:
            return clearForm(state, action);
        case ActionTypes.DISABLE_FORM:
            return disableForm(state, action);
        case ActionTypes.ENABLE_SPINNER:
            return enableSpinner(state, action);
        case ActionTypes.FILL_FORM:
            return fillForm(state, action);
        case ActionTypes.SHOW_NOTIFICATION:
            return showNotification(state, action);
        case ActionTypes.HIDE_NOTIFICATION:
            return hideNotification(state, action);
        case ActionTypes.ADD_LANGUAGE:
            return addLanguage(state, action);
        case ActionTypes.ADD_LANGUAGES:
            return addLanguages(state, action);
        case ActionTypes.ADD_DEFAULT_LANGUAGE:
            return addDefaultLanguage(state, action);
        case ActionTypes.SET_SELECTED_LANGUAGE:
            return setSelectedLanguage(state, action);
        case ActionTypes.ADD_LISTING_LANGUAGE:
            return addListingLanguage(state, action);
        case PromotionActionTypes.GET_PROMOTION_SUCCESS:
            return editPromotion(state, action);
        case PromotionActionTypes.SET_SELECTED_PROMOTION:
            return editPromotion(state, action);
        case ActionTypes.REMOVE_LANGUAGE:
            return removeLanguage(state, action);
        case PrizeActionType.GET_PRIZE_SUCCESS:
            return editPrize(state, action);
        case ActionTypes.ADD_FLOW_LABEL:
            return addFlowLabel(state, action);
        case ActionTypes.REMOVE_FLOW_LABEL:
            return removeFlowLabel(state, action);
        case ActionTypes.ADD_CURRENCY:
            return addCurrency(state, action);
        case ActionTypes.ADD_COST_ITEM_TO_PRIZE:
            return addCostItemToPrize(state, action);
        case ActionTypes.REMOVE_CURRENCY:
            return removeCurrency(state, action);
        case ActionTypes.REMOVE_COST_ITEM_FROM_PRIZE:
            return removeCostItemFromPrize(state, action);
        case ActionTypes.ADD_CONFIGURATION_PARAMETER:
            return addConfigurationParameter(state,action);
        case ActionTypes.ADD_ADDITIONAL_INFO_PARAMETER:
            return addAdditionalInfoParameter(state,action);
        case ActionTypes.CLEAR_CURRENCY_LIST:
            return clearCurrencyList(state);
        case ActionTypes.CHANGE_DATETIME:
            return changeDateTime(state, action);
        case ActionTypes.SET_CURRENCIES_BY_CONFIG:
            return setCurrencies(state, action);
        case ActionTypes.EMAIL_TEMPLATE_GET_SUCCESS:
            return getEmailTemplateSuccess(state, action);
        case ActionTypes.EMAIL_TEMPLATE_GET_UPDATED:
            return getEmailTemplateUpdated(state, action);
        case ActionTypes.SET_PRIZE_COST:
            return setPrizeCost(state, action);
        case ActionTypes.CLEAR_ALL:
            return clearAll(state, action);
        case ActionTypes.SET_PRIZE_TAGS:
            return setPrizeTags(state, action);
        case ActionTypes.ADD_FILE_ITEM_ADDITION:
            return addFileItemAddition(state, action);
        case ActionTypes.REMOVE_FILE_ITEM_ADDITION:
            return removeFileItemAddition(state,action);
        case ActionTypes.CHANGE_PROP:
            return changeProp(state, action);
        default:
            return {...state};
    }
};

const editPrize = (state, action) => {
    return {
        ...state,
        [Source.PRIZE_FORM]: !action.payload ? initialState[Source.PRIZE_FORM] : {
            ...action.payload.data.prizeDetails,
            useStartEndDates: action.payload.data.prizeDetails.endDate ? true : false,
            startDate: action.payload.data.prizeDetails.startDate || initialState[Source.PRIZE_FORM].startDate,
            endDate: action.payload.data.prizeDetails.endDate || initialState[Source.PRIZE_FORM].endDate,
            localizedFieldsCounter: {...state[Source.PRIZE_FORM].localizedFieldsCounter},
            languages: {...state[Source.PRIZE_FORM].languages},
            selectedLanguage: {...state[Source.PRIZE_FORM].selectedLanguage},
            languageForListing: {...state[Source.PRIZE_FORM].languageForListing},
            currencies: {...state[Source.PRIZE_FORM]}.currencies,
            messages: {...state[Source.PRIZE_FORM]}.messages,
            enableValidityPeriodAfterClaim: !!action.payload.data.prizeDetails.validityPeriodAfterClaim
        }
    }
};

const getEmailTemplateUpdated = (state, action) => {
    return {
        ...state,
        _shouldUpdate: false
    }
};

const getEmailTemplateSuccess = (state, action) => {
    const { payload: templateData } = { ...action };

    return {
        ...state,
        [Source.EMAIL_TEMPLATES_FORM]: {
            ...state[Source.EMAIL_TEMPLATES_FORM],
            ...templateData
        },
        _shouldUpdate: true
    }
};

const changeText = (state, action) => {
    const form = action.source;
    const field = action.event.target.name;
    const content = action.event.target.value;
    if (form === Source.PROMOTION_FORM && Source.PROMOTION_FORM_MANDATORY_FIELDS.includes(field)) {
        return handlePromotionFormMandatoryFields(state, form, field, content);
    }
    if (form === Source.PRIZE_FORM && Source.PRIZE_FORM_LOCALIZED_FIELDS.includes(field)) {
        return handleLocalizationFieldsState(state, form, field, content);
    }
    if (form === Source.CONFIGURATION_FORM && Source.CONFIGURATION_FORM_MANDATORY_FIELDS.includes(field)) {
        return handleConfigurationFormMandatoryFields(state,field, content);
    }
    if (form === Source.EMAIL_TEMPLATES_FORM && Source.EMAIL_TEMPLATES_FORM_MANDATORY_FIELDS.includes(field)) {
        return emailTemplates(state, field, content);
    }
    if (form === Source.EMAIL_TEMPLATES_FORM && Source.EMAIL_TEMPLATES_FORM_LOCALIZATION_LABELS.includes(field)) {
        return emailTemplatesLocalizationLabels(state, field, content);
    }
    return handleFieldsState(state, form, field, content);
};

const emailTemplates = (state, field, content) => {
    return {
        ...state,
        [Source.EMAIL_TEMPLATES_FORM]: {
            ...state[Source.EMAIL_TEMPLATES_FORM],
            [field]: content,
            errors: {
                ...state[Source.EMAIL_TEMPLATES_FORM].errors,
                [field]: ""
            }
        }
    }
}

const emailTemplatesLocalizationLabels = (state, field, content) => {
    return {
        ...state,
        [Source.EMAIL_TEMPLATES_FORM]: {
            ...state[Source.EMAIL_TEMPLATES_FORM],
            localizationLabels: {
                ...state[Source.EMAIL_TEMPLATES_FORM].localizationLabels,
                [field]: content
            },
            errors: {
                ...state[Source.EMAIL_TEMPLATES_FORM].errors
            }
        }
    }
}

const getPriorityOptions = (imagesMetadata, languageCode) => {
    let priorityOptions = [];

    // set all options as not selected
    for(let i = 0; i< Source.PRIZE_IMAGES_MAX; i++) {
        priorityOptions.push({value: i + 1, selected: false});
    }

    // select the first option by default for a new prize
    if(!imagesMetadata.hasOwnProperty(languageCode)) {
        priorityOptions[0] = {value: 1, selected: true};
        return priorityOptions;
    }

    // if the priority is taken, mark the option as selected
    imagesMetadata[languageCode].map((item) => {
        if(item.priority) {
            priorityOptions[item.priority - 1] = {value: item.priority, selected: true};
        }
    })

    return priorityOptions;
}

const changeImageMetadata = (state, action) => {
    const newImagesMetadata = { ...state[action.source][Source.IMAGES_METADATA] };

    newImagesMetadata[action.language][action.index][action.name] = action.value;
    let newLangPriorityOptions = [...state[Source.PRIZE_FORM].priorityOptions[action.language]];

    if (action.name === 'priority') {
        newLangPriorityOptions = getPriorityOptions(newImagesMetadata, action.language);
    };

    return {
        ...state,
        [action.source]: {
            ...state[action.source],
            imagesMetadata: newImagesMetadata,
            priorityOptions: {
                ...state[Source.PRIZE_FORM].priorityOptions,
                [action.language]: newLangPriorityOptions
            }
        }
    };
};

const setPrizeImages = (state, action) => {
    const newImagesMetadata =
    {...state[Source.PRIZE_FORM][Source.IMAGES_METADATA]};

    let newPriorityOptions = {...state[Source.PRIZE_FORM].priorityOptions};

    // Backwards compatibility: if the prize doesn't have 'images_metadata' attribute, generate empty metadata fields for each image
    for(const languageKey in state[Source.PRIZE_FORM].languages) {
        if (!newImagesMetadata.hasOwnProperty(languageKey)) {
            newImagesMetadata[languageKey] = [];
            for(const currentUrl of state[Source.PRIZE_FORM].imgUrl) {
                newImagesMetadata[languageKey].push(
                    new ImageMetadata({url: currentUrl, size: "", priority: "", name: "", ratio: "", activeStatus: ""}))
            }
        }

        newPriorityOptions[languageKey] = getPriorityOptions(newImagesMetadata, languageKey);
    }

    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            imagesMetadata: newImagesMetadata,
            priorityOptions: newPriorityOptions
        }
    };
};

const changeNumber = (state, action) => {
    return {
        ...state,
        [action.source]: {
            ...state[action.source],
            [action.name]: action.value
        }
    };
};

const changeCheckbox = (state, action) => {
    const field = action.event.target.name;
    const value = action.event.target.checked;

    return {
        ...state,
        [action.source]: {
            ...state[action.source],
            [field]: value
        }
    };
};

const handleConfigurationFormMandatoryFields = (state, field, content) => {
    const contentParam = content === null ? '' : content;
    if (contentParam.length > 0 || String(contentParam).length > 0 ) {
        switch (field) {
            case "promotionId":
                return handleFieldsState(state, Source.CONFIGURATION_FORM, field, contentParam);
            case 'name':
                return handleAdditionalInformationFieldsState(state, field, contentParam)
            case "country":
            case "userIdType":
            case "language":
            case "currencies":
            case "configurationStartUtc":
            case "configurationEndUtc":
            case "emailTemplateId":
                return handleConfigurationParametersFieldsState(state, field, contentParam);
        }
    } else {
        switch (field) {
            case "promotionId":
                return handleRequiredConfigurationParam(state, field, contentParam);
            case 'name':
                return handleAdditionalInformationFieldsState(state, field, contentParam)
            case "country":
            case "userIdType":
            case "language":
            case "currencies":
            case "configurationStartUtc":
            case "configurationEndUtc":
            case "emailTemplateId":
                return handleRequiredConfigurationParametersParam(state, field, contentParam);
        }
    }
};

const handleRequiredConfigurationParametersParam = (state, field, content) => ({
    ...state,
    [Source.CONFIGURATION_FORM]: {
        ...state[Source.CONFIGURATION_FORM],
        configurationParameters: {
            ...state[Source.CONFIGURATION_FORM].configurationParameters,
            [field]: content,
        },
        messages: {
            ...state[Source.CONFIGURATION_FORM].messages,
            [field]: Messages.FIELD_REQUIRED
        }
    },
});

const handleRequiredConfigurationParam = (state, field, content) => ({
    ...state,
    [Source.CONFIGURATION_FORM]: {
        ...state[Source.CONFIGURATION_FORM],
        [field]: content,
        messages: {
            ...state[Source.CONFIGURATION_FORM].messages,
            [field]: Messages.FIELD_REQUIRED
        }
    }
});

const handleConfigurationParametersFieldsState = (state, field, content) => ({
    ...state,
    [Source.CONFIGURATION_FORM]: {
        ...state[Source.CONFIGURATION_FORM],
        configurationParameters: {
            ...state[Source.CONFIGURATION_FORM].configurationParameters,
            [field]: content,
        },
        messages: {
            ...state[Source.CONFIGURATION_FORM].messages,
            [field]: ""
        }
    }
});

const handleAdditionalInformationFieldsState = (state, field, content) => ({
    ...state,
    [Source.CONFIGURATION_FORM]: {
        ...state[Source.CONFIGURATION_FORM],
        configurationParameters: {
            ...state[Source.CONFIGURATION_FORM].configurationParameters,
            additionalInformation: {
                ...state[Source.CONFIGURATION_FORM].configurationParameters.additionalInformation,
                [field]: content
            }
        },
        messages: {
            ...state[Source.CONFIGURATION_FORM].messages,
            [field]: ""
        }
    }
});

const handleFlowParametersFieldsState = (state, field, content) => ({
    ...state,
    [Source.CONFIGURATION_FORM]: {
        ...state[Source.CONFIGURATION_FORM],
        flow: {
            ...state[Source.CONFIGURATION_FORM].flow,
            [field]: content,
        },
        messages: {
            ...state[Source.CONFIGURATION_FORM].messages,
            flow: ""
        }
    }
});

const changeDateTime = (state, action) => {
    const form = action.source;
    const field = action.props.name;
    const content = action.props.date;
    if (form === Source.PROMOTION_FORM && Source.PROMOTION_FORM_MANDATORY_FIELDS.includes(field)) {
        return handlePromotionFormMandatoryFields(state, form, field, content);
    }
    if (form === Source.PRIZE_FORM && Source.PRIZE_FORM_LOCALIZED_FIELDS.includes(field)) {
        return handleLocalizationFieldsState(state, form, field, content);
    }

    if (form === Source.PRIZE_FORM && field === 'startDate') {
        const updateFields = {
            [field]: content,
            endDate: new Date(content).setUTCHours(23, 59, 59, 999)
        }
        return handleMultipleFieldsUpdateState(state, form, updateFields);
    }


    return handleFieldsState(state, form, field, content);
};

const handlePromotionFormMandatoryFields = (state, form, field, content) => {
    const contentParam = content === null ? '' : content;
    if (contentParam.length > 0 || String(contentParam).length > 0 ) {
        return handleFieldsState(state, form, field, contentParam);
    }
    return {
        ...state,
        [Source.PROMOTION_FORM]: {
            ...state[Source.PROMOTION_FORM],
            [field]: contentParam,
            messages: {
                ...state[Source.PROMOTION_FORM].messages,
                [field]: "This field is required!"
            }
        }
    };
};

const handleFieldsState = (state, form, field, content) => ({
    ...state,
    [form]: {
        ...state[form],
        [field]: content,
        messages: {
            ...state[form].messages,
            [field]: ""
        }
    }
});

/**
 * Function to that takes in an object of values and adds it into the state
 * @param {*} state
 * @param {*} form
 * @param {*} content - object of values that will be added into the state
 */
const handleMultipleFieldsUpdateState = (state, form, content) => {
    let updatedState = {
        ...state,
        [form]: {
            ...state[form],
            messages: {
                ...state[form].messages,
            }
        }
    }

    Object.entries(content).forEach(element => {
        updatedState[form][element[0]] = element[1];
        updatedState[form].messages[element[0]] = ""
    });

    return updatedState;
};

const handleLocalizationFieldsState = (state, form, field, content) => {
    const selectedLanguageCode = getSelectedLanguageCode(state[Source.PRIZE_FORM].selectedLanguage);

    return {
        ...state,
        [form]: {
            ...state[form],
            [field]: {
                ...state[form][field],
                [selectedLanguageCode]: content
            },
            localizedFieldsCounter: {
                ...state[form].localizedFieldsCounter,
                [field]: {
                    ...state[form].localizedFieldsCounter[field],
                    [selectedLanguageCode]: striptags(content).length
                }
            }
        }
    };
};

const changeSelect = (state, action) => {
    const form = action.source;
    const field = action.event.target.name;
    const content = action.event.target.value;
    if (form === Source.PROMOTION_FORM && Source.PROMOTION_FORM_MANDATORY_FIELDS.includes(field)) {
        return handlePromotionFormMandatoryFields(state, form, field, content);
    }
    return {
        ...state,
        [action.source]: {
            ...state[action.source],
            [action.event.target.name]: action.event.target.value
        }
    };
};

const setPrizeCost = (state, action) => {
    const formState = state[Source.PRIZE_FORM];
    const value = formState.cost || [];
    const cost = action.payload === "standard" ? value : null;
    const newFormState = { ...state[Source.PRIZE_FORM], cost };
    return { ...state, [Source.PRIZE_FORM]: newFormState };
};

const changeCurrency = (state, action) => {
    const formState = state[Source.PRIZE_FORM];
    const newCost = [...state[Source.PRIZE_FORM].cost];

    newCost[action.index] = {
        name: action.currencyId ? formState.currencies.find(c => c.currencyId === action.currencyId).name : newCost[action.index].name,
        currencyId: action.currencyId || newCost[action.index].currencyId,
        amount: typeof action.amount === 'number' ? action.amount : newCost[action.index].amount
    };

    const newFormState = { ...state[Source.PRIZE_FORM], cost: newCost };
    return { ...state, [Source.PRIZE_FORM]: newFormState };
};

/** handle error messages  */
const setFieldsMessages = (state, action) => {
    const { formType, fields } = action;
    const message = fields.length > 0 ? Messages.FIELD_REQUIRED : null;
    const newMessages = { ...state[formType].messages };
    for (let field in fields) {
        newMessages[fields[field]] = message;
    }
    return {
        ...state,
        [formType]: {
            ...state[formType],
            messages: newMessages
        }
    }
};

const setFieldError = (state, action) => {
    const { field, formName, errorMessage } = action;

    return {
        ...state,
        [formName]: {
            ...state[formName],
            errors: {
                ...state[formName].errors,
                [field]: errorMessage
            }
        }
    }
};


const setFieldsErrors = (state, action) => {
    const { fields, formName } = action;
    const errorMessage = fields && fields.length > 0 ? Messages.FIELD_REQUIRED : null;
    if (!formName || !state[formName].errors) {
        return {
            ...state
        };
    }
    const newErrors = { ...state[formName].errors };

    for (let field in fields) {
        newErrors[fields[field]] = errorMessage;
    }
    return {
        ...state,
        [formName]: {
            ...state[formName],
            errors: newErrors
        }
    }
};


const clearFieldError = (state, action) => {
    const { formName, field } = action;
    console.log("FIRE CLEAR ERROR ONE FIELD", action, field)
    return {
        ...state,
        [formName]: {
            ...state[formName],
            errors: {
                ...state[formName].errors,
                [field]: ""
            }
        }
    }
}

const clearFieldsErrors = (state, action) => {
    const { formName } = action;

    return {
        ...state,
        [formName]: {
            ...state[formName],
            errors: {}
        }
    }
}

const setPrizeTags = (state, action) => {
    const newFormState =  {
        ...state[Source.PRIZE_FORM],
        tags: action.payload
    };

    return {
        ...state,
        [Source.PRIZE_FORM]: newFormState
    };
}

const changeFile = (state, { event, source, isValid, customMessage }) => {
    const message = isValid ? "" : (customMessage ? customMessage : Messages.INVALID_FILE_TYPE);

    return {
        ...state,
        [source]: {
            ...state[source],
            [event.target.name]: event.target.value,
            messages: {
                ...state[source].messages,
                [event.target.name]: message
            }
        }
    };
};

const changeFileUpload = (state, payload)=> {
    const message = payload.isValid ? "" : Messages.INVALID_FILE_TYPE;

    const oldValue = state[Source.PRIZE_FORM].imgUrl;
    const newValue = [...oldValue];
    newValue[payload.index] = payload.value;
    const oldMessages = state[Source.PRIZE_FORM].messages.imgUrl;
    oldMessages[payload.index] = message;

    const oldImagesMetadata = state[Source.PRIZE_FORM][Source.IMAGES_METADATA];
    let newImagesMetadata = {...oldImagesMetadata};
    newImagesMetadata[payload.language][payload.index].url = payload.value;
    newImagesMetadata[payload.language][payload.index]["imgFile"] = payload.event.target.files[0];
    const oldMultiLangImgMessages = state[Source.PRIZE_FORM].messages[Source.IMAGES_METADATA];
    oldMultiLangImgMessages[payload.index] = message;

    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            imgUrl: newValue,
            imagesMetadata: newImagesMetadata,
            messages: {
                ...state[Source.PRIZE_FORM].messages,
                imgUrl: oldMessages
            }
        }
    };
};

const changeDigitalCodesFileUpload = (state, payload) => {
    // const message = payload.isValid ? "" : Messages.INVALID_FILE_TYPE;
    const oldValue = state[Source.AUTO_UPLOAD_DIGITAL_CODES_FORM].digitalCodes;
    const newValue = [...oldValue];
    newValue[payload.index] = payload.value;
     console.log('DIGITAL CODES REDUCER - STATE', state);
    console.log('CHANGE DIGITAL CODES FILE UPLOAD REDUCER PAYLOAD ', payload);
    // const oldMessages = state[Source.AUTO_UPLOAD_DIGITAL_CODES_FORM].messages.imgUrl;
    // oldMessages[payload.index] = message;
    return {
        ...state,
        [Source.AUTO_UPLOAD_DIGITAL_CODES_FORM]: {
            ...state[Source.AUTO_UPLOAD_DIGITAL_CODES_FORM],
            digitalCodes: newValue,
            // messages: {
            //     ...state[Source.AUTO_UPLOAD_DIGITAL_CODES_FORM].messages,
            //     digitalCodes: oldMessages
            // }
        }
    };
}


const clearForm = (state, action) => {
    let clearState = { ...initialState[action.formName]};
    let currentState = state[action.formName];
    if(action.fieldsToSkip && action.fieldsToSkip.length > 0) {
        action.fieldsToSkip.forEach(fieldToSkip => {clearState[fieldToSkip] = currentState[fieldToSkip]});
    }
    return {
        ...state,
        [action.formName]: {
            ...clearState
        }
    };
};

const disableForm = (state, action) => {
    return {
        ...state,
        [action.formName]: {
            ...state[action.formName],
            formDisabled: action.formStatus
        }
    }
};


const enableSpinner = (state, action) => {
    return {
        ...state,
        [action.formName]: {
            ...state[action.formName],
            spinnerEnabled: action.spinnerStatus
        }
    }
};

const fillForm = (state, action) => {
    const { formName, formData } = action;
    return {
        ...state,
        [formName]: {
            ...formData
        }
    };
};

const showNotification = (state, action) => {
    return {
        ...state,
        notification: {
            ...state.notification,
            title: action.payload.title,
            visible: action.payload.visible,
            type: action.payload.type,
            message: action.payload.message,
            disableAutoHide: action.payload.disableAutoHide
        }
    };
};

const hideNotification = (state, action) => {
    return {
        ...state,
        notification: {
            ...state.notification,
            visible: false,
        }
    };
};

//clear ERROR & NOTIFICATIONs
const clearAll = (state, action) => {
    const { formName } = action;

    return {
        ...state,
        [formName]: {
            ...state[formName],
            errors: {}
        },
        notification: {
            ...initialState.notification
        }
    };
};
/**
 * Triggered on "Add New Language" event
 */
const addLanguage = (state, action) => {
    const { languages, desc, name, shortDesc, redeemDesc, imagesMetadata, priorityOptions } = state[Source.PRIZE_FORM];

    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            languages: {
                ...languages,
                [action.language.code]: action.language.name
            },
            desc: {
                ...desc,
                [action.language.code]: ""
            },
            name: {
                ...name,
                [action.language.code]: ""
            },
            shortDesc: {
                ...shortDesc,
                [action.language.code]: ""
            },
            redeemDesc: {
                ...redeemDesc,
                [action.language.code]: ""
            },
            imagesMetadata: {
                ...imagesMetadata,
                [action.language.code]: [
                    new ImageMetadata({})]
            },
            priorityOptions: {
                ...priorityOptions,
                [action.language.code]: getPriorityOptions(imagesMetadata, action.language.code)
            }
        }
    };
};

const addLanguages = (state, action) => {
    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            languages: action.languages
        }
    }
};

const addDefaultLanguage = (state, action) => {
    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            languages: {
                [action.language.code]: action.language.name
            }
        }
    };
};

const setSelectedLanguage = (state, action) => {
    const { languageTab } = action;
    const languages = {...state[Source.PRIZE_FORM].languages};
    const selectedLanguage = Object.entries(languages)[languageTab];
    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            selectedLanguage: {
                [selectedLanguage[0]]: selectedLanguage[1]
            }
        }
    };
};

const addListingLanguage = (state, action) => {
    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            languageForListing: {
                [action.language.code]: action.language.name
            }
        }
    };
};

const editPromotion = (state, action) => {
    return {
        ...state,
        [Source.PROMOTION_FORM]: !action.payload ? initialState[Source.PROMOTION_FORM] : {...action.payload.data.promotionMetadata}
    }
};

const removeLanguage = (state, action) => {
    const prizeForm = {
        languages: {...state[Source.PRIZE_FORM].languages},
        name: {...state[Source.PRIZE_FORM].name},
        desc: {...state[Source.PRIZE_FORM].desc},
        shortDesc: {...state[Source.PRIZE_FORM].shortDesc},
        redeemDesc: {...state[Source.PRIZE_FORM].redeemDesc},
        imagesMetadata: {...state[Source.PRIZE_FORM].imagesMetadata},
        localizedFieldsCounter: {...state[Source.PRIZE_FORM].localizedFieldsCounter},
        selectedLanguage: {...state[Source.PRIZE_FORM].selectedLanguage}
    };
    // setting new selected key
    const languageKeys = Object.keys(prizeForm.languages);
    const selectedLanguageIndex = languageKeys.indexOf(Object.keys(prizeForm.selectedLanguage)[0]);
    const newKey = action.language.code === languageKeys[selectedLanguageIndex] ? languageKeys[selectedLanguageIndex - 1] : languageKeys[selectedLanguageIndex];
    prizeForm.selectedLanguage = {[newKey]: prizeForm.languages[newKey]};
    // delete language prefix and form text
    Object.keys(prizeForm).forEach(key => {
        if (prizeForm.localizedFieldsCounter[key]) {
            delete prizeForm.localizedFieldsCounter[key][action.language.code];
        }
        if (prizeForm.imagesMetadata[key]) {
            delete prizeForm.imagesMetadata[key][action.language.code];
        }
        delete prizeForm[key][action.language.code];
    });
    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            languages: prizeForm.languages,
            name: prizeForm.name,
            desc: prizeForm.desc,
            shortDesc: prizeForm.shortDesc,
            redeemDesc: prizeForm.redeemDesc,
            imagesMetadata: prizeForm.imagesMetadata,
            localizedFieldsCounter: prizeForm.localizedFieldsCounter,
            selectedLanguage: prizeForm.selectedLanguage
        }
    };
};

const addFlowLabel = (state, action) => {
    const field = action.payload.flowLabelKey;
    const content =  action.payload.flowLabelObject;
    return handleFlowParametersFieldsState(state, field, content);
};

const removeFlowLabel = (state, action) => {
    const flow = {...state[Source.CONFIGURATION_FORM].flow};
    const field = "flow";
    const content = "";
    delete flow[action.payload.flowLabelKey];
    if (!Object.values(flow).length) {
        return handleRequiredConfigurationParam(state,field,content);
    }
    return {
        ...state,
        [Source.CONFIGURATION_FORM]: {
            ...state[Source.CONFIGURATION_FORM],
            flow
        }
    };
};

const addConfigurationParameter = (state, action) => {
    const field = action.payload.key;
    const content = action.payload.value;

    if (Source.CONFIGURATION_FORM_MANDATORY_FIELDS.includes(field)) {
        return handleConfigurationFormMandatoryFields(state, field, content);
    }
    if (field === 'additionalInformation') {
        return {
            ...state,
            [Source.CONFIGURATION_FORM]: {
                ...state[Source.CONFIGURATION_FORM],
                configurationParameters: {
                    ...state[Source.CONFIGURATION_FORM].configurationParameters,
                    [action.payload.key]: {...action.payload.value, ...{name: state[Source.CONFIGURATION_FORM].configurationParameters.additionalInformation.name}}
                }
            }
        }
    }
    return {
        ...state,
        [Source.CONFIGURATION_FORM]: {
            ...state[Source.CONFIGURATION_FORM],
            configurationParameters: {
                ...state[Source.CONFIGURATION_FORM].configurationParameters,
                [action.payload.key]: action.payload.value
            }
        }
    }
};

const addAdditionalInfoParameter = (state, action) => {
    const field = action.payload.key;
    const content = action.payload.value;

    if (Source.CONFIGURATION_FORM_MANDATORY_FIELDS.includes(field)) {
        return handleConfigurationFormMandatoryFields(state, field, content);
    }

    return {
        ...state,
        [Source.CONFIGURATION_FORM]: {
            ...state[Source.CONFIGURATION_FORM],
            configurationParameters: {
                ...state[Source.CONFIGURATION_FORM].configurationParameters,
                additionalInformation: {
                    ...state[Source.CONFIGURATION_FORM].configurationParameters.additionalInformation,
                    [action.payload.key]: action.payload.value
                }
            }
        }
    }
};

const addCurrency = (state, action) => {
    const field = "currencies";
    const content = [
        ...state[Source.CONFIGURATION_FORM].configurationParameters.currencies,
        action.payload.currencyId
    ];
    return handleConfigurationParametersFieldsState(state, field, content);
};

const removeCurrency = (state, action) => {
    const newCurrencies = state[Source.CONFIGURATION_FORM].configurationParameters.currencies.filter(currency => currency !== action.payload.currencyId);
    const field = "currencies";
    const flows = state[Source.CONFIGURATION_FORM].flow;
    let currencyMandatory = false;
    for(let flow in flows){
        if(Source.CURRENCY_MANDATORY_FLOWS.includes(flow)){
            if(flow === "redeemPincodeForCurrencies" || (flow === "instantWin" && state[Source.CONFIGURATION_FORM].flow.instantWin.flowLambdas.includes("currencyReducer"))){
                currencyMandatory = true;
            }
        }
    }
    if(!newCurrencies.length && currencyMandatory) {
        return handleRequiredConfigurationParametersParam(state,field,newCurrencies);
    }
    return {
        ...state,
        [Source.CONFIGURATION_FORM]: {
            ...state[Source.CONFIGURATION_FORM],
            configurationParameters: {
                ...state[Source.CONFIGURATION_FORM].configurationParameters,
                currencies: newCurrencies
            }
        }
    };
};

const clearCurrencyList = state => {
    return {
        ...state,
        [Source.CONFIGURATION_FORM]: {
            ...state[Source.CONFIGURATION_FORM],
            configurationParameters: {
                ...state[Source.CONFIGURATION_FORM].configurationParameters,
                currencies: []
            }
        }
    };
};

const setCurrencies = (state, action) => {
    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            currencies: action.currencies,
        }
    }
};

const addCostItemToPrize = (state, { currency }) => {
    const { cost } = state[Source.PRIZE_FORM];

    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            cost: [...cost, currency]
        }
    };
};

const removeCostItemFromPrize = (state, { currency }) => {
    const { cost } = state[Source.PRIZE_FORM];
    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            cost: cost.filter(costItem => costItem.currencyId !== currency.currencyId)
        }
    }
};

const addFileItemAddition = (state) => {
    const selectedLanguageCode = getSelectedLanguageCode(state[Source.PRIZE_FORM].selectedLanguage);

    let newImagesMetadata = {...state[Source.PRIZE_FORM][Source.IMAGES_METADATA]};

    // find the index of the first priority option in the list
    const firstUnselectedIndex = state[Source.PRIZE_FORM].priorityOptions[selectedLanguageCode].findIndex(e => e.selected === false);

    // add a new prize image with the first priority option
    newImagesMetadata[selectedLanguageCode].push(
        new ImageMetadata({priority: firstUnselectedIndex + 1}));

    // update priority options
    let newLangPriorityOptions = getPriorityOptions(newImagesMetadata, selectedLanguageCode);

    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            imgUrl: [...state[Source.PRIZE_FORM].imgUrl, ""],
            imagesMetadata: newImagesMetadata,
            priorityOptions: {
                ...state[Source.PRIZE_FORM].priorityOptions,
                [selectedLanguageCode]: newLangPriorityOptions
            },
            messages: {
                ...state[Source.PRIZE_FORM].messages,
                imgUrl: [...state[Source.PRIZE_FORM].messages.imgUrl, ""],
                imagesMetadata: [...state[Source.PRIZE_FORM].messages[Source.IMAGES_METADATA], ""],
            }
        }
    };
};


const removeFileItemAddition = (state, action) => {
    const oldValue = state[Source.PRIZE_FORM].imgUrl;
    const newValue = [...oldValue];

    const selectedLanguageCode = getSelectedLanguageCode(state[Source.PRIZE_FORM].selectedLanguage);

    const newImagesMetadata = {...state[Source.PRIZE_FORM][Source.IMAGES_METADATA]};
    let filteredImages = newImagesMetadata[selectedLanguageCode].filter((_, i)=>{
        return i !== action.index;
    });

    newImagesMetadata[selectedLanguageCode] = filteredImages;


    let newPriorityOptions = getPriorityOptions(newImagesMetadata, selectedLanguageCode);

    return {
        ...state,
        [Source.PRIZE_FORM]: {
            ...state[Source.PRIZE_FORM],
            imgUrl: newValue.filter((_, i) => i !== action.index),
            imagesMetadata: newImagesMetadata,
            priorityOptions: {
                ...state[Source.PRIZE_FORM].priorityOptions,
                [selectedLanguageCode]: newPriorityOptions
            }
        }
    };
};

const addDigitalCodes = (state) => {
    console.log('ADD DIGITAL CODES REDUCER', state);
   return {
        ...state,
        [Source.AUTO_UPLOAD_DIGITAL_CODES_FORM]: {
            ...state[Source.AUTO_UPLOAD_DIGITAL_CODES_FORM],
            digitalCodes: [...state[Source.AUTO_UPLOAD_DIGITAL_CODES_FORM].digitalCodes, ""],
        }
    };
};

const removeDigitalCodes = (state, action) => {
    const oldValue = state[Source.AUTO_UPLOAD_DIGITAL_CODES_FORM].digitalCodes;
    const newValue = [...oldValue];
    return {
        ...state,
        [Source.AUTO_UPLOAD_DIGITAL_CODES_FORM]: {
            ...state[Source.AUTO_UPLOAD_DIGITAL_CODES_FORM],
            digitalCodes: newValue.filter((_, i) => i !== action.index),
        }
    };
};

const changeProp = (state, action) => {
    return {
        ...state,
        [action.source]: {
            ...state[action.source],
            [action.name]: action.value
        }
    };
};

export default uiReducer;
