const STAGE_NAME = process.env.stageName;

const TABLES = {
    WINNING_MOMENTS_TABLE: `winning_moments_${STAGE_NAME}`,
    WINNING_CODES_TABLE: `winning_codes_${STAGE_NAME}`,
    UNSUCCESSFUL_BURN_ATTEMPTS_TABLE: `unsuccessful_burn_attempts_${STAGE_NAME}`,
    EXPIRATION_WALLET_TABLE: `expiration_wallet_${STAGE_NAME}`,
    GPP_CURRENCY_ALLOCATION_RULES_TABLE: `gpp_currency_allocation_rules_table_${STAGE_NAME}`,
    GPP_TRANSACTION_TABLE: `gpp_transaction_table_${STAGE_NAME}`,
    GPP_USER_ROLES_TABLE: `gpp_user_roles_table_${STAGE_NAME}`,
    GPP_PARTICIPATIONS_TABLE: `gpp_participations_table_${STAGE_NAME}`,
    GPP_UNSUCCESSFUL_BURN_ATTEMPTS_TABLE: `unsuccessful_burn_attempts_${STAGE_NAME}`,
    PARTICIPATION_PINCODES_TABLE: `participation_pincodes_table_${STAGE_NAME}`,
    GPP_WALLET_TABLE: `gpp_wallet_table_${STAGE_NAME}`,
    GPP_CURRENCY_TABLE: `gpp_currency_table_${STAGE_NAME}`,
    GPP_PRIZE_CATALOGUE_TABLE: `gpp_prize_catalogue_table_${STAGE_NAME}`,
    GPP_DIGITAL_CODES_TABLE: `gpp_digital_codes_table_${STAGE_NAME}`,
    GPP_PROMOTIONS_TABLE: `gpp_promotions_table_${STAGE_NAME}`,
    GPP_EMAIL_TEMPLATES_TABLE: `gpp_email_templates_table_${STAGE_NAME}`,
    GPP_BLOCKED_USERS_TABLE: `gpp_blocked_users_table_${STAGE_NAME}`,
    MISCELLANEOUS_VALUES_TABLE: `miscellaneous_values_table_${STAGE_NAME}`,
    GPP_ARCHIVED_UNBLOCKED_USERS_TABLE: `gpp_archived_unblocked_users_table_${STAGE_NAME}`,
    GDPR_REQUESTS_TABLE: `gdpr_requests_table_${STAGE_NAME}`,
    GPP_CLIENTS_SIGNATURE_TABLE: `gpp_clients_signature_table_${STAGE_NAME}`,
    GPP_BLOCKED_PARTICIPATIONS_TABLE: `gpp_blocked_participations_table_${STAGE_NAME}`,
    GPP_REFERRAL_RECORDS_LOCK: `referral_records_lock_${STAGE_NAME}`,
    GPP_CIRCUIT_BREAKER: `gpp_circuit_breaker_table_${STAGE_NAME}`,
};

module.exports = {
    ...TABLES,
};
