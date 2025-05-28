import axios from 'axios';
import { getFileName } from '../helpers/utils';
import currencyAllocationRules from '../components/CurrencyAllocationRulesList/CurrencyAllocationRules.mockdata';
import { prepareCurrencyAllocationRulesData } from '../helpers/utils';
import { removeAllWhitespaceInFileName } from '../helpers/validations';
import { generateSignedRequest } from '../helpers/requestGenerator';
const uniqid = require("uniqid");
/**
 * Function that makes api call to endpoint for creating new prize.
 * Steps are:
 * 1. Get file upload details for prize image in order to make http request for file upload to S3 public bucket
 * 2. Upload prize image
 * 3. Create new prize by creating new item in prize_catalogue table
 * @param object - containing data from store
 */
const savePrize = async ({ data }) => {

    data.flowLabel = "addPrize";
    data.prizeParams.prizeId = uniqid();

    console.log("%c Saving to prize catalogue table...", "color: blue; font-weight: bold; font-size: 14px");

    // Validate prize images count. At least one image required for a prize.
    let prizeImageUrlArr = Object.values(data.prizeParams.imagesMetadata).flat().filter((el) => el.url);
    if(!prizeImageUrlArr.length) throw new Error('Missing image file! Please upload at least one image for the prize.');

    const processedData = await processPrizeImages(data);
    const signedSavePrizeRequest = await generateSignedRequest(processedData);
    const response = await axios(signedSavePrizeRequest);

    const prizeId = response.data.entry.prizeId;
    console.log("%c Successfully saved prize to prize catalogue - response:", "color: green; font-weight: bold; font-size: 14px", JSON.stringify(response));
    return ({ ...response, prizeId })
};

const processPrizeImages = async(data) => {
    const prizeImageFiles = data.prizeParams.imagesMetadata;

    for(let languageCode in prizeImageFiles) {
        let hasFileChanged = false;
         prizeImageFiles[languageCode].map((item) => {
            if(item.hasOwnProperty('imgFile')) hasFileChanged = true;
            if(!item.size) delete item.size;
            if(!item.priority) delete item.priority;
        })

        // If no image files changed in the language, skip the image processing
        if(!hasFileChanged) {
            console.log('No changed images found in language: ', {languageCode})
            continue;
        }

        const imgUrlList = await getMultipleImgUrls(prizeImageFiles, data.prizeParams.prizeId, data.prizeParams.configurationId, languageCode);

        imgUrlList.map((item, index) => {
            prizeImageFiles[languageCode][index].url = item.data.imageUrl;
        })

       await uploadPrizeImagesToS3(imgUrlList, prizeImageFiles[languageCode]);
    }

    data.prizeParams.imgUrl = getImgUrlContent(data);
    return data;
}

/**
 * Function that extract the whole metadata for the imgUrls and gets them together in a single array to be passed to the next consuming func.
 *
 * @param {*} prizeImageFiles - takes the prizeImageFiles
 * @param {*} prizeId  - prizeId of the configuration
 * @param {*} configurationId  - configurationId
 */
const getMultipleImgUrls = (prizeImageFiles, prizeId, configurationId, languageCode) => {
    let promisesImgUrlArrayResult = [];
    if (prizeImageFiles[languageCode].length > 0) {
        for (let i = 0; i < prizeImageFiles[languageCode].length; i++) {
            if (prizeImageFiles[languageCode][i].url) {
                let currentImgUrl = prizeImageFiles[languageCode][i].url;
                console.log("%c Current IMG URL  file upload details for prize image...", "color: blue; font-weight: bold; font-size: 14px", currentImgUrl);
                const arbiterParams = {
                    configurationId: configurationId,
                    flowLabel: "prizeImageUpload",
                    fileName: getFileName(currentImgUrl),
                    prizeImageUpload: true,
                    prizeId: prizeId,
                    languageCode: languageCode
                };
                console.log("%c Getting file upload details for prize image...", "color: blue; font-weight: bold; font-size: 14px");
                const getFileDetails = getFileUploadDetails(arbiterParams);
                promisesImgUrlArrayResult.push(getFileDetails);
            }
        }
    }
    return Promise.all(promisesImgUrlArrayResult);
};


/**
 * The function creates an array only with the img_urls, so we can send only the needed info to the BE, not the whole metadata.
 *
 * @param {*} data - data from the original passed event to the function
 */
const buildAndSendImgUrlArray = (data) => {
    let copyData = JSON.parse(JSON.stringify(data));
    copyData.flowLabel = "uploadPrizeImages";
    copyData.prizeParams.imgUrl = getImgUrlContent(data);
    return prizeImageUpload(copyData);
};

/**
 * The function creates an unique array for img_urls. If the array only contains one element, the array will be converted to a string.
 *
 * @param {*} data - data from the original passed event to the function
 */
const getImgUrlContent = (data) => {
    let imgUrls = Object.values(data.prizeParams.imagesMetadata)
        .flat()
        .reduce((resultArr, imageMetadata) => {
            if (imageMetadata.url) resultArr.push(imageMetadata.url);
            return resultArr;
        }, []);

    imgUrls = [...new Set(imgUrls)];
    return imgUrls.length === 1 ? imgUrls[0] : imgUrls;
};
/**
 * Functions that goes thru all received files and uploads them to an s3 bucket.
 * @param {*} response - received from main event of the multiplePrizeImg builder, list of imgUrls.
 * @param {*} langPrizeImageFiles - the prizeImageFiles of a language
 */
const uploadPrizeImagesToS3 = (response, langPrizeImageFiles) => {
    const promisesUploadFileArray = [];

    for (const element of response) {
        const fileUploadDetails = element.data.fileUploadDetails;
        const fileName = getFileName(element.data.imageUrl);
        for (const img of langPrizeImageFiles) {
            if (img.imgFile && encodeURI(img.imgFile.name) === fileName) {
                const newFile = uploadFile(fileUploadDetails, img.imgFile, img.url, "image");
                promisesUploadFileArray.push(newFile);
                delete img.imgFile;
            }
        }
    }

    return Promise.all(promisesUploadFileArray);
};

/**
 * Function that makes api call to endpoint for editing prize.
 * Steps are:
 * 1. Update prize details to prize_catalogue table
 * 2. Get file upload details for prize image(s) in order to make http request for file upload to S3 public bucket
 * 3. Upload prize image(s)
 * 4. Update existing prize id by updating item in prize_catalogue table
 * @param object - containing data from store and event object for getting the reference to the file object
 */
const editPrize = ({ data, event }) => {
    data.flowLabel = "updatePrize";

    let signedRequest = generateSignedRequest(data);
    console.log("%c Saving to prize catalogue table...", "color: blue; font-weight: bold; font-size: 14px");

    return axios(signedRequest)
        .then(response => {
            console.log("%c Successfully edited prize to prize catalogue - response:", "color: green; font-weight: bold; font-size: 14px", JSON.stringify(response));
            return processPrizeImages(data);
        })
        .then(processedData => buildAndSendImgUrlArray(processedData)
        )
        .catch(error => {
            console.log("%c Error:", "color: red; font-weight: bold; font-size: 14px", JSON.stringify(error.message));
            return Promise.reject(error);
        });
};

/**
 * Upload multiple csv files containing digital codes to specific s3 bucket which will not trigger fileListenerLambda
 */
const autoUploadDigitalCodes = async (data, event) => {
    const digitalCodes = NodeList.prototype.isPrototypeOf(event.target.digitalCodes) ? [...event.target.digitalCodes] : [event.target.digitalCodes]
    const prizeId = data.prizeId;
    const configurationId = data.configurationId;
    let firstDigitalCodeValue = digitalCodes[0].value;
    let indexOfDigitalCodeName = firstDigitalCodeValue.split("\\");
    let digitalCodeName = indexOfDigitalCodeName[indexOfDigitalCodeName.length-1];

    await uploadVouchersToS3(digitalCodes, configurationId, prizeId);
            let anotherArbiterParams = {
                    configurationId: configurationId,
                    prizeId: prizeId,
                    flowLabel: "initialWriteDigitalCodesUpload",
                    fileNames: digitalCodeName
            };
    return autoUploadDigitalCodesInitialWrite(anotherArbiterParams);
}


/**
 * Functions that goes thru an array of csv files and uplodas them to s3,
 * after the upload is finished it will trigger the digitalCodesBulkUploadLambda,
 * which will take the first file from the array of csv and writte it in dynamodb.
 * @param {*} data
 * @param {*} event
 */

const uploadVouchersToS3 = async (digitalCodes, configurationId, prizeId) => {
     for (const digitalCode of digitalCodes) {
        const digitalCodeValue = digitalCode.value;
        const digitalCodeCsv = digitalCode.files[0];
        if (!digitalCodeValue) {
            return Promise.reject({message: 'Missing digital codes file!'});
        }

        const arbiterParams = {
            configurationId: configurationId,
            prizeId: prizeId,
            flowLabel: "bulkVoucherCodesInsertion",
            fileName: getFileName(digitalCodeValue)
        };

        try {
        const fileUploadDetails = await getFileUploadDetails(arbiterParams);
        await uploadFile(fileUploadDetails.data.fileUploadDetails, digitalCodeCsv, digitalCodeValue, "text/csv");
        } catch(error) {
            console.log("%c Error:", "color: red; font-weight: bold; font-size: 14px", JSON.stringify(error));
        }
     };
};

/**
 * Upload digital codes file to s3
 * In order to trigger the fileUploadListener that will upload them to DB
 * @param object - containing data from store and event object for getting the reference to the file object
 */
const uploadDigitalCodes = (data, event) => {
    const digitalCodesCsvFile = event.target.digitalCodes.files[0];
    const digitalCodes = event.target.digitalCodes.value;
    const prizeId = data.prizeId;
    if (!digitalCodes) {
        return Promise.reject({ message: 'Missing digital codes file!' });
    }

    const arbiterParams = {
        configurationId: data.configurationId,
        prizeId: prizeId,
        flowLabel: "voucherCodesInsertion",
        fileName: getFileName(digitalCodes)
    };
    console.log("%c Getting file upload details for digital codes csv file...", "color: blue; font-weight: bold; font-size: 14px");

    return getFileUploadDetails(arbiterParams)
        .then(response => {
            console.log("%c Successfully get upload details for digital codes csv file - response: ", "color: green; font-weight: bold; font-size: 14px", JSON.stringify(response));
            console.log("%c Uploading digital codes csv file to S3 public bucket...", "color: blue; font-weight: bold; font-size: 14px");
            return uploadFile(response.data.fileUploadDetails, digitalCodesCsvFile, digitalCodes, "text/csv");
        })
        .then(response => ({ ...response, prizeId }))
        .catch(error => {
            console.log("%c Error:", "color: red; font-weight: bold; font-size: 14px", JSON.stringify(error));
            return Promise.reject(error);
        });
};


/**
 * Function that makes http request for getting needed params and details for csv upload to
 * be prepared for upload request.
 * @param {*} data
 */
const getFileUploadDetails = data => {
    let signedRequest = generateSignedRequest(data);
    return axios(signedRequest)
        .then(response => {
            console.log("Received file upload details: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Upload file to s3 bucket, which will trigger fileUploadLambda
 * @param {Object} fileUploadDetails - json with details and params for making the request for upload
 * @param {Object} file - reference object to the file which will be uploaded
 * @param {string} fileName - name of the file
 */
const uploadFile = (fileUploadDetails, file, fileName, contentType) => {
    const { urlToUpload, clientConditions } = fileUploadDetails;
    const formData = new FormData();
    formData.append('Content-Type', contentType);
    formData.append('key', clientConditions['key']);
    formData.append('acl', clientConditions['acl']);
    formData.append('x-amz-meta-uuid', clientConditions['x-amz-meta-uuid']);
    formData.append('x-amz-server-side-encryption', clientConditions['x-amz-server-side-encryption']);
    formData.append('x-amz-credential', clientConditions['x-amz-credential']);
    formData.append('x-amz-algorithm', clientConditions['x-amz-algorithm']);
    formData.append('x-amz-date', clientConditions['x-amz-date']);
    formData.append('x-amz-meta-tag', clientConditions['x-amz-meta-tag']);
    formData.append('policy', clientConditions['policy']);
    formData.append('x-amz-signature', clientConditions['x-amz-signature']);
    formData.append('file', file, fileName);
    return axios.post(urlToUpload, formData, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'multipart/form-data'
        }
    })
        .then(response => {
            console.log("File upload response: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for fetching all prizes for provided configurationId
 * @param {string} configurationId
 * @param {string} language - language code
 */
const getPrizes = ({ configurationId, language, filter = "all" }) => {
    let country, promotionName;
    const data = {
        configurationId,
        language,
        flowLabel: "listPrizes",
        filter: filter
    };
    return getConfiguration(configurationId)
        .then(response => {
            console.log("%c Configuration response: ", "color: green; font-weight: bold; font-size: 14px", JSON.stringify(response));
            country = response.data.configurationMetadata.configurationParameters.country;
            const promotionId = response.data.configurationMetadata.promotionId;
            return getPromotion(promotionId);
        })
        .then(response => {
            console.log("%c Promotion response: ", "color: green; font-weight: bold; font-size: 14px", JSON.stringify(response));
            promotionName = response.data.promotionMetadata.promotionName;
            const signedRequest = generateSignedRequest(data);
            return axios(signedRequest);
        })
        .then(response => {
            response.data.country = country;
            response.data.promotionName = promotionName;
            return Promise.resolve(response.data);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Function that makes http request for fetching prize data
 * @param {string} configurationId
 * @param {string} prizeId
 */
const getPrize = ({ configurationId, prizeId }) => {
    const data = {
        flowLabel: "getPrize",
        prizeParams: {
            configurationId,
            prizeId
        }
    };
    const signedRequest = generateSignedRequest(data);
    console.log(`%c Fetching prize with prizeId ${prizeId} and configurationId ${configurationId} ...`, "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            const imgUrls = response.data.prizeDetails.imgUrl;
            if (!Array.isArray(response.data.prizeDetails.imgUrl)) {
                response.data.prizeDetails.imgUrl = [imgUrls];
            }
            console.log("Prize: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            if (error.response.status == 404) {
                error.message = "Prize does not exist!";
            }
            return Promise.reject(error);
        });
};

const savePromotionConfiguration = data => {
    data.flowLabel = "configStore";
    let signedRequest = generateSignedRequest(data);
    console.log("%c Saving to config store...", "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log("Saving to config store: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for adding new promotion
 */
const savePromotion = data => {
    const params = {
        flowLabel: "promotionCreate",
        promotionMetaData: data
    };
    let signedRequest = generateSignedRequest(params);
    console.log("%c Saving to DynamoDB...", "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log("Saving to DynamoDB: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for adding new configuration
 */
const saveConfiguration = (data, prizeImg) => {
    const params = {
        promotionId: data.promotionId,
        flowLabel: "configStore",
        isEdit: data.isEdit
    };

    if (data.isEdit) {
        params.configurationId = data.configurationId;
        delete data.isEdit;
    }

    params.configuration = data;
    let savePrizeResponse;
    let signedRequest = generateSignedRequest(params);
    console.log("%c Saving to DynamoDB...", "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            return Promise.resolve(response);
        })
        .then(response => {
            savePrizeResponse = response
            if(prizeImg) {
                return uploadAdditionalInfoPrizeImage(response.data.configurationId, prizeImg)
            }
        })
        .then(() => savePrizeResponse)
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Uploads image file for configuration additional information
 */

 const uploadAdditionalInfoPrizeImage = (configurationId, prizeImg) => {
    const imgUploadParameters = {
        flowLabel: "additionalInformationImageUpload",
        configurationId: configurationId,
        fileName: removeAllWhitespaceInFileName(prizeImg.name)
    };
    return getFileUploadDetails(imgUploadParameters)
        .then(response => uploadFile(response.data.fileUploadDetails, prizeImg, prizeImg.name, prizeImg.type))
 }


/**
 * Makes http request for adding new JS SDK configuration
 */
const saveJsSdkConfiguration = (data, fileName, isEdit) => {
    const params = {
        promotionId: data.promotionId,
        flowLabel: "configStore",
        jsSdkCreation: true,
        fileName: fileName,
        configuration: data,
        isEdit
    }
    let signedRequest = generateSignedRequest(params);
    return axios(signedRequest)
        .then(response => {
            console.log("Config uploaded to S3: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

const getJsSdkConfiguration = (fileName) => {
    const params = {
        flowLabel: "getConfiguration",
        jsSdkRetrieve: true,
        fileName: fileName,
    }
    let signedRequest = generateSignedRequest(params);
    return axios(signedRequest)
        .then(response => {
            return Promise.resolve(response.data.configurationMetadata);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * TODO: Replace existing code with commented one after backend functionalities for fetching
 *       currency allocation rules are added. Also made some additional sync if needed and
 *       remove import of mockdata.
 * Makes http request for fetching all currency allocation rules for provided configurationId
 * @param {string} configurationId
 */
const getRules = ({ configurationId }) => {

    const params = {
        configurationId,
        flowLabel: "listCurrencyAllocationRules",
    };
    let signedRequest = generateSignedRequest(params);
    return axios(signedRequest)
        .then(response => {
            console.log("Received currency allocation rules: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });

    let filtered = currencyAllocationRules.filter(rule => rule.configurationId === configurationId);
    if (filtered.length === 0) {
        return Promise.reject("Configuration Id does not exist!");
    }
    let prepared = prepareCurrencyAllocationRulesData(filtered);
    return Promise.resolve(prepared);
};

/**
 * Makes http request for adding currency allocation rule
 */
const saveCurrencyAllocationRule = data => {
    let params = {
        flowLabel: "addCurrencyAllocationRule",
        ...data
    };
    let signedRequest = generateSignedRequest(params);
    console.log("%c Saving to currency allocation table ...", "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log("Saving to currency allocation table: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for editing currency allocation rule
 */
const editCurrencyAllocationRule = editData => {
    let deletionTimestamp = (Date.now());
    let params = {
        flowLabel: "editCurrencyAllocationRule",
        configurationId: editData.configurationId,
        ruleId: editData.ruleId,
        allocationRuleParams: {
            amount: editData.amount,
            currencyId: editData.currencyId
        }

    };

    if(editData.validity){
        params.allocationRuleParams.validity = editData.validity;
    }
    if(editData.userKoId){
        params.allocationRuleParams.userKoId = editData.userId;
    }
    if(editData.jiraTicketId){
        params.allocationRuleParams.jiraTicketId = editData.jiraTicketId;
    }
    if(editData.jiraTicketId && editData.userKoId){
        params.allocationRuleParams.ruleActive = false;
        params.allocationRuleParams.deletionTimestamp = deletionTimestamp;
    }
    let signedRequest = generateSignedRequest(params);

    console.log("%c EDITING ... . . . . to currency allocation table ...", "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log("Updated currency allocation table: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Function that makes api call to endpoint for generating new winning moments.
 * @param data - contains the needed params for building the request
 */
const generateWinningMoments = data => {
    const requestParams = {
        flowLabel: "generateMoments",
        configurationId: data.configurationId,
        startDate: data.startTimestamp,
        endDate: data.endTimestamp,
        prizeDistributionDefect: data.prizeDistributionDefect,
        timestampDistributionDefect: data.timestampDistributionDefect,
        winningMomentExpiration: data.winningMomentExpiration
    };

    return axios(generateSignedRequest(requestParams))
        .then(response => {
            return Promise.resolve({ csvParams: {}, csvContent: response.data.csv });
        })
};

/**
 * Function that makes api call to endpoint for generating new winning moments per specified prizes.
 * @param data - contains the needed params for building the request
 */
const generateWinningMomentsPerPrize = data => {
    return axios(generateSignedRequest({
        flowLabel: "generateMoments",
        generatorType: "advanced",
        configurationId: data.configurationId,
        prizeParams: data.prizeParams
    }))
        .then(response => {
            return Promise.resolve({ csvParams: {}, csvContent: response.data.csv });
        });
}

/**
 * Function that makes api call to endpoint for uploading csv file with new winning moments.
 * Steps are:
 * 1. Get file upload details for winning moments in order to make http request for file upload to S3 private bucket
 * 2. Upload winning moments csv file
 * @param object - containing configurationId and file
 */
const saveWinningMoments = ({ configurationId, file }) => {

    const arbiterParams = {
        flowLabel: "winningMomentsInsertion",
        configurationId: configurationId,
        fileName: removeAllWhitespaceInFileName(file.name)
    };
    console.log("Getting file upload details...");
    return getFileUploadDetails(arbiterParams)
        .then(response => {
            console.log("Received file upload details: ", JSON.stringify(response));
            return Promise.resolve(response.data.fileUploadDetails);
        })
        .then(fileUploadDetails => uploadFile(fileUploadDetails, file, file.name, "text/csv"))
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

const queryTable = data => {
    console.log("%c Querying ...", "color: blue; font-weight: bold; font-size: 14px");
    let signedRequest = generateSignedRequest(data);
    return axios(signedRequest)
        .then(response => {
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for fetching all currencies from Currency table
 */
const getAllCurrencies = () => {
    const params = {
        flowLabel: "getAllCurrencies",
    }
    let signedRequest = generateSignedRequest(params);
    console.log(`% Fetching all currencies from Currency table ...`, "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for fetching all email templates from email templates table
 */
const getAllEmailTemplates = () => {
    const params = {
        flowLabel: "getAllEmailTemplates",
    };
    let signedRequest = generateSignedRequest(params);
    console.log(`% Fetching all email templates from email templates table ...`, "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Function that makes http request for fetching configuration data
 * @param {object} - object containing configurationId property
 * @return {Promise} - promise object with configuration result
 */
const getConfiguration = configurationId => {
    const data = {
        configurationId,
        flowLabel: "getConfiguration"
    };
    const signedRequest = generateSignedRequest(data);
    console.log("%c Fetching configuration data ...", "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest);
};

/**
 * getCurrencyCodes from backend
 * based on getCurrencyCodes flow
 */
const getCurrencyCodes = () => {
    const reqData = {
        flowLabel: "getCurrencyCodes"
    };
    const signedRequest = generateSignedRequest(reqData);
    return axios(signedRequest)
        .then(resData => {
            const valuesData = resData.data.currencyCodes;
            return Promise.resolve(valuesData);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
}
/**
 * Function that makes http request for fetching promotion data
 * @param {object} - object containing promotionId property
 * @return {Promise} - promise object with promotion result
 */
const getPromotion = promotionId => {
    const data = {
        promotionId,
        flowLabel: "getPromotion"
    };
    const signedRequest = generateSignedRequest(data);
    console.log(`%c Fetching promotion with id ${promotionId} ...`, "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log("Promotion: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for fetching all currencies for specific configuration from Currency table
 * @param {Array} currenciesIds - array which contain all currencies ids
 */
const getCurrenciesForConfiguration = (currenciesIds) => {
    const params = {
        flowLabel: "getCurrenciesByIds",
        currenciesProviderParams: {
            currencies: currenciesIds
        }
    };
    let signedRequest = generateSignedRequest(params);
    console.log(`% Fetching specific currencies from Currency table ...`, "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log("Matched currencies: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

const getEmailTemplate = (templateId) => {
    let sendData = {
        flowLabel: "getEmailTemplate",
        emailTemplateParams: {
            templateId
        }
    };
    const initialIcons = {
        placeholder: "Social URL",
        btnLink: "",
        file: ""
    };
    const signedData = generateSignedRequest(sendData);
    return axios(signedData)
        .then(resData => {
            const { data } = resData;
            if (data.emailTemplateMetadata) {
                let icons = [];
                let socialIconsAndLinks = [];
                if (data.emailTemplateMetadata.socialIconsAndLinks) {
                    socialIconsAndLinks = [...data.emailTemplateMetadata.socialIconsAndLinks];
                    icons = [...data.emailTemplateMetadata.socialIconsAndLinks];
                } else {
                    socialIconsAndLinks = [{ ...initialIcons }];
                    icons = [{ ...initialIcons }];
                }

                return Promise.resolve({
                    data: {
                        ...data.emailTemplateMetadata,
                        socialIconsAndLinks,
                        icons
                    }
                });
            } else {
                return Promise.reject({ error: "Missing email template." });
            }
        })
};

//saveType - add || edit
const saveEmailTemplatesText = (templateData, saveType = 'add') => {
    let sendData = {
        flowLabel: saveType === "edit" ? "updateEmailTemplate" : "addEmailTemplate",
        emailTemplateParams: {
            ...templateData
        }
    }

    const signedData = generateSignedRequest(sendData);
    return axios(signedData)
        .then(resData => {
            if (saveType === "edit") {
                return Promise.resolve({ templateId: templateData.templateId });
            }

            const templateId  = resData.data.entry.templateId;
            return Promise.resolve(templateId);
        }).catch(err => {
            return Promise.reject({ ...err, errType: saveType + "Text" });
        });
};

/**
 * saveEmailTemplatesImages
 *
 * @param {String} templateId
 * @param {Object} headerImage - {name, size, type, file}
 * @param {Array} socialIcons
 * @param {Array} saveType - add or edit(based on formType)
 *
 * @returns {Promise}
 */
const saveEmailTemplatesImages = (templateId, headerImage, socialIcons, saveType = "add") => {
    if (!templateId) {
        return Promise.reject({ error: "Missing or Empty templateId!" });
    } else if (!headerImage.file && socialIcons.length === 0) {
        return Promise.resolve();
    }
    const sendData = {
        flowLabel: saveType === "edit" ? "updateImagesEmailTemplate" : "uploadImagesEmailTemplate",
        emailTemplateParams: {
            templateId,
            headerImage,
            icons: socialIcons
        }
    };
    const signedData = generateSignedRequest(sendData);
    return axios(signedData)
        .then(res => Promise.resolve({ res }))
        .catch(err => Promise.reject({ ...err, errType: saveType + "Images" }))
};


/**
 * Makes http request for fetching participation by pincode
 * @param {String} pincode
 */
const getParticipation = ({ pincode }) => {

    const getParticipationIdParams = {
        flowLabel: "getPincodesParticipation",
        analysisLambdaFlowParams: {
            queryParams: "mixcodes_pincode",
            queryValues: pincode
        }
    };

    const getParticipationParams = {
        flowLabel: "getParticipation",
        analysisLambdaFlowParams: {
            queryParams: "participation_id",
            queryValues: null
        }
    };

    let signedRequest = generateSignedRequest(getParticipationIdParams);
    console.log(`% Fetching participation...`, "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log("Participation ID found: ", JSON.stringify(response));
            getParticipationParams.analysisLambdaFlowParams.queryValues = response.data.result[0].data[0].participation_id;
            signedRequest = generateSignedRequest(getParticipationParams);
            return axios(signedRequest);
        })
        .then(response => {
            console.log("Participationfound: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for fetching participation by userId
 * @param {String} userId
 */
const getParticipationByUserId = ({ userId }) => {

    const getParticipationByUserIdParams = {
        flowLabel: "getParticipation",
        analysisLambdaFlowParams: {
            queryParams: "gpp_user_id",
            queryValues: userId
        }
    };

    let signedRequest = generateSignedRequest(getParticipationByUserIdParams);
    console.log(`% Fetching participations...`, "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log(". by userID : ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for fetching participation by configurationId
 * @param {String} configurationId
 */
const getParticipationByConfigId = ({ configurationId }) => {

    const getParticipationByConfigIdParams = {
        flowLabel: "getParticipation",
        analysisLambdaFlowParams: {
            queryParams: "configuration_id",
            queryValues: configurationId
        }
    };

    let signedRequest = generateSignedRequest(getParticipationByConfigIdParams);
    console.log(`% Fetching participations...`, "color: blue; font-weight: bold; font-size: 14px");
    return axios(signedRequest)
        .then(response => {
            console.log(". by Configuration ID : ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes request for exporting participation by configurationId
 * @param {String} configurationId
 * @param {String} startDate
 * @param {String} endDate
 */
 const exportParticipations = (configurationId, startDate, endDate) => {

    const exportParticipationsParams = {
        flowLabel: "exportParticipations",
        configurationId: configurationId,
        startDate: startDate,
        endDate:endDate
    };

    let signedRequest = generateSignedRequest(exportParticipationsParams);
    return axios(signedRequest)
        .then(response => {
            return Promise.resolve(response.data && response.data.url);
        })
        .catch(error => {
            return Promise.reject(error.response && error.response.data);
        });
};
/**
 * Makes http request to save blocked consumer (User) in gpp_blocked_users_table
 * @param {Object} { configurationId, userId, enteredById, requestedById, reason, title }
 */
const saveBlockedConsumer = (data) => {
    const blockedConsumerParams = {
        flowLabel: "consumerBlocking",
        ...data
    };

    const signedRequest = generateSignedRequest(blockedConsumerParams);
    return axios(signedRequest)
        .then(response => {
            console.log(". blocked consumer: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error2: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Makes http request for fetching participation by voucher
 * @param {String} digitalVoucher
 */
const getDigitalCodesByVoucher = ({ digitalVoucher }) => {
    const signedRequest = generateSignedRequest({
        flowLabel: "getDigitalCodes",
        analysisLambdaFlowParams: {
            queryParams: "voucher",
            queryValues: digitalVoucher
        }
    });

    console.log(
        `% Fetching participations...`,
        "color: blue; font-weight: bold; font-size: 14px"
    );

    return axios(signedRequest)
        .then(response => {
            console.log(". by voucher : ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};

const saveCurrency = (currency) => {
    const signedRequest = generateSignedRequest({
        flowLabel: "currencyCreation",
        dbOperationParams: {
            name: currency.currencyName,
            country: currency.country,
            currencyFamily: currency.currencyFamily,
            origin: currency.currencyOrigin,
            currencyId: currency.currencyId,
            iconUrl: currency.iconUrl,
        }
    });

    console.log(
        `% Saving currency...`,
        "color: blue; font-weight: bold; font-size: 14px"
    );

    return axios(signedRequest)
        .then(response => {
            console.log("Saved : ", JSON.stringify(response));
            return Promise.resolve(response.data);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
}

const saveCurrencyData = async (currency, icon) => {
    try {
        currency.currencyId = uniqid();

        if (icon) {
            const iconUploadParams = {
                flowLabel: "currencyIconUpload",
                fileName: removeAllWhitespaceInFileName(icon.name),
                currencyId: currency.currencyId,
                currencyIconUpload: true,
            };
            await getFileUploadDetails(iconUploadParams)
                .then(response => {
                    currency.iconUrl = response.data.imageUrl;
                    return uploadFile(response.data.fileUploadDetails, icon, icon.name, icon.type);
                });

        }

        const res = await saveCurrency(currency);
        return res;
    } catch (error) {
        throw error;
    }
};

/**
 * Makes http request for fetching blocked consumer for different configurations
 * @param {Object} data {userId: userId, consumerBlockingFlow: 'list'}
 */
const getBlockedConsumer = (data) => {
    const getBlockedConsumerParams = {
        flowLabel: "blockedConsumerList",
        ...data
    };
    const signedRequest = generateSignedRequest(getBlockedConsumerParams);
    return axios(signedRequest)
        .then(response => {
            console.log(". blocked consumer: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};
/**
 * Makes http request to unblocked consumer for specific configurations
 * @param {Object} data { gppUserId: "gppUserId", configurationId: "configurationId", enteredById: "enteredById", requestedById: "requestedById", consumerBlockingFlow: 'unblocked'}
 */
const unblockConsumer = (data) => {
    const unblockConsumerParams = {
        flowLabel: "consumerUnblocking",
        ...data
    };
    const signedRequest = generateSignedRequest(unblockConsumerParams);
    return axios(signedRequest)
        .then(response => {
            console.log(". unblocked consumer: ", JSON.stringify(response));
            return Promise.resolve(response);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        });
};


const loginDetails = (koId) => {
    const signedRequest = generateSignedRequest({
        flowLabel: "getUserRole",
        analysisLambdaFlowParams: {
            queryParams: "ko_id",
            queryValues: koId
        }
    });

    return axios(signedRequest)
        .then(response => {
            return Promise.resolve(response.data);
        })
        .catch(error => {
            console.log("Error: ", JSON.stringify(error));
            return Promise.reject(error);
        })
}

const prizeImageUpload = (data) => {
    const signedRequest = generateSignedRequest(data)
    return axios(signedRequest)
        .then(response => {
            console.log('Image URL array is : ', response);
            return Promise.resolve(response.data)
        })
        .catch(error => {
            console.log('Error while trying to get Image URL array : ', error);
            return Promise.reject(error);
        })
}

const autoUploadDigitalCodesInitialWrite = (data) => {
  const signedRequest = generateSignedRequest(data)
    return axios(signedRequest)
        .then(response => {
            console.log('Digital Code Data is : ', response);
            return Promise.resolve(response.data)
        })
        .catch(error => {
            console.log('Error while trying to write data to big file and upload initial batch: ', error);
            return Promise.reject(error);
        })
}

const downloadReplication = (data) => {
    const signedRequest = generateSignedRequest({
        flowLabel: 'downloadReplication',
        ...data
    });
    signedRequest.responseType = 'text';

    return axios(signedRequest)
        .then(response => {
            const blob = base64ToBlob(response.data)

            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = response.headers['content-disposition'].match(/filename=(.*\.zip)/)[1];

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            return Promise.resolve(response.data);
        })
        .catch(error => {
            return Promise.reject(error);
        })
};

const base64ToBlob = (base64String) => {
    const binaryString = atob(base64String);

    const binaryStringLen = binaryString.length;
    const byteArray = new Uint8Array(binaryStringLen);
    for (let i = 0; i < binaryStringLen; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
    }

    return new Blob([byteArray], { type: 'application/zip' });
}

const uploadReplication = (data, file) => {
    if (!file) {
        return Promise.reject({ message: 'Missing replication package!' });
    }

    return getFileUploadDetails({
        flowLabel: "replicationPackageInsertion",
        fileName: file.name
    })
        .then(response => {
            console.log("%c Successfully get upload details for replication package - response: ", "color: green; font-weight: bold; font-size: 14px", JSON.stringify(response));
            console.log("%c Uploading replication package to S3 private bucket...", "color: blue; font-weight: bold; font-size: 14px");
            return uploadFile(response.data.fileUploadDetails, file, file.name, file.type);
        })
        .catch(error => {
            console.log("%c Error:", "color: red; font-weight: bold; font-size: 14px", JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Function that makes api call to endpoint for uploading csv file with new winning moments.
 * Steps are:
 * 1. Get file upload details for winning moments in order to make http request for file upload to S3 private bucket
 * 2. Upload winning moments csv file
 * @param object - containing configurationId and file
 */
 const saveBulkPrizes = async (data, event, isEditBulk) => {
    const file = event.target.prizeFile.files[0];
    let arbiterParams = {
        flowLabel: "bulkPrizeInsertion",
        configurationId: data.configurationId,
        fileName: removeAllWhitespaceInFileName(file.name)
    }
    if(isEditBulk) {
        arbiterParams  = {
            flowLabel: "bulkPrizeUpdate",
            configurationId: data.configurationId,
            fileName: removeAllWhitespaceInFileName(file.name)
        }
    }

    console.log("Getting file upload details...");
    try {
        const response = await getFileUploadDetails(arbiterParams);
        let result = await uploadFile(response.data.fileUploadDetails, file, file.name, file.type)
        return result;
    } catch (err) {
        console.error(err)
        throw new Error(err)
    }
};

const API = {
    prizes: {
        save: savePrize,
        saveBulk: saveBulkPrizes,
        getAllPrizesForConfiguration: getPrizes,
        get: getPrize,
        edit: editPrize
    },
    digitalCodes: {
        add: uploadDigitalCodes
    },
    autoDigitalCodes: {
        add: autoUploadDigitalCodes
    },
    configurations: {
        save: saveConfiguration,
        get: getConfiguration
    },
    currencyCodes: {
        get: getCurrencyCodes
    },
    currencyAllocationRules: {
        getCurrencyAllocationRules: getRules,
        save: saveCurrencyAllocationRule,
        edit: editCurrencyAllocationRule
    },
    promotions: {
        save: savePromotion,
        get: getPromotion
    },
    queryTable: {
        getQueryResult: queryTable
    },
    currencies: {
        get: getAllCurrencies,
        getByIds: getCurrenciesForConfiguration
    },
    emailTemplatesForConfiguration: {
        get: getAllEmailTemplates
    },
    winningMoments: {
        save: saveWinningMoments,
        generate: generateWinningMoments,
        generatePerPrize: generateWinningMomentsPerPrize
    },
    emailTemplates: {
        get: getEmailTemplate,
        getList: getAllEmailTemplates,
        saveText: saveEmailTemplatesText,
        saveImages: saveEmailTemplatesImages
    },
    participations: {
        get: getParticipation,
        getByUserId: getParticipationByUserId,
        getByConfigId: getParticipationByConfigId,
        getByVoucher: getDigitalCodesByVoucher,
        export: exportParticipations
    },
    jsSdkConfiguration: {
        save: saveJsSdkConfiguration,
        get: getJsSdkConfiguration
    },
    blockedConsumer: {
        save: saveBlockedConsumer,
        get: getBlockedConsumer,
        unblocked: unblockConsumer
    },
    currencyCreation: {
        save: saveCurrencyData
    },
    getUserRole: {
        get: loginDetails
    },
    replication: {
        download: downloadReplication,
        upload: uploadReplication
    }
};

export default API;
