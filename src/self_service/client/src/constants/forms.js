export const PRIZE_FORM = "prizeForm";
export const EXPORT_PARTICIPATIONS_FORM = "exportParticipationsForm";
export const DIGITAL_CODES_UPLOAD_FORM = "digitalCodesUploadForm";
export const AUTO_UPLOAD_DIGITAL_CODES_FORM = "autoUploadDigitalCodesForm";
export const CURRENCY_ALLOCATION_RULES_FORM = "currencyAllocationRulesForm";
export const PROMOTION_FORM = "promotionForm";
export const CONFIGURATION_FORM = "configurationForm";
export const QUERY_TABLE_FORM = "queryTableForm";
export const PRIZE_FORM_LOCALIZED_FIELDS = ["name", "desc", "shortDesc", "redeemDesc"];
export const EMAIL_TEMPLATES_FORM="emailTemplatesForm";
export const PARTICIPATION_TABLE_FORM = "participationTableForm";
export const CURRENCY_CREATION_FORM = "currencyCreationForm";
export const DIGITAL_CODES_BY_VOUCHER_TABLE_FORM = "digitalCodesByVoucherForm"
export const WINNING_MOMENTS_FORM = "winningMomentsForm"
export const DOWNLOAD_REPLICATION_FORM = "downloadReplicationForm";
export const UPLOAD_REPLICATION_FORM = "uploadReplicationForm";
export const BULK_PRIZE_UPLOAD_FORM = "bulkPrizeUploadForm";

export const LOCALIZED_FIELDS_MAX_CHARS = {
    name: 150,
    desc: 1000,
    shortDesc: 250,
    redeemDesc: 1000
};

export const CONFIGURATION_FORM_MANDATORY_FIELDS = [
    "promotionId", "country", "userIdType", "language", "configurationStartUtc", "configurationEndUtc", "flow", "name"
];

export const CURRENCY_MANDATORY_FLOWS = [
    "redeemPincodeForCurrencies", "instantWin"
];

export const PROMOTION_FORM_MANDATORY_FIELDS = [
    "promotionName", "promotionOwner", "promotionAuthor", "promotionMarket", "promotionBu", "promotionTg", "promotionBrand",
    "promotionPrizeType", "promotionFunction", "promotionCampaign", "digitalExperience",
    "promoType", "promotionEntity", "promotionTransaction", "promotionStartUtc", "promotionEndUtc"
];

export const EMAIL_TEMPLATES_FORM_MANDATORY_FIELDS = [
    "country", "templateName", "subjectText", "senderEmail", "sesConfigSets", "sesEmailTemplate"
];
export const EMAIL_TEMPLATES_FORM_LOCALIZATION_LABELS = [
    "expiryLabel", "redemptionLabel"
];

export const INITIAL_LANGUAGE_KEY = "en-GB";

export const CONFIGURATION_TAGS = {
    propertyName: "tags",
    costPropertyName: "cost",
    includePinCodeTag: "instantwinpe",
    includeCostTag: "instantwincost"
}

export const IMAGES_METADATA = "imagesMetadata";

export const PRIZE_IMAGE_SIZES = {
    thumbnail: "Thumbnail",
    small: "Small",
    medium: "Medium",
    large: "Large"
}
export const PRIZE_IMAGE_RATIO = {
    vertical: "Vertical",
    horizontal: "Horizontal",
    square: "Square"
}

export const PRIZE_IMAGE_STATUS = {
    true: "True",
    false: "False"
}

export const PRIZE_IMAGES_MAX = 5;

export const IMAGE_METADATA_DEFAULTS = {
    size: "medium",
    priority: 1,
    ratio: "vertical",
    activeStatus: false
}
