const {
    VERIFIERS,
    RegexPatterns,
    BASE_URL,
    PROD_STAGE_NAME,
    CustomJwtCheck,
    Matchers,
    StringToBeReplaced,
    StageNameTransformer,
} = require('./b2cUrls-constants');

/**
 * Represents a class that handles JWT token verification.
 */
class JwtTokenVerifiers {
    /**
     * Constructs a new instance of the B2CV2Urls class.
     * @param {Object} params - The parameters for initializing the B2CV2Urls instance.
     * @param {Array} params.verifiers - The verifiers array.
     * @param {Array} params.regexPatterns - The regex patterns array.
     * @param {boolean} params.customJwtCheck - The custom JWT check flag.
     * @param {Array} params.matchers - The matchers array.
     * @param {string} params.baseUrl - The base URL.
     * @param {string} params.prodStage - The production stage.
     * @param {string} params.stringToBeReplaced - The string to be replaced.
     * @param {function} params.stageNameTransformer
     * - The function to transform a stage name if shouldTransformStageName is set in verifiers object.
     */
    constructor(params) {
        Object.assign(this, params);
    }

    /**
     * Retrieves the JWT verification entities.
     * @returns {Array} An array of objects containing the issuer, audience, and customJwtCheck properties.
     */
    getJwtVerificationEntities() {
        // Mapping over the verifiers and returning an array of objects
        return Object.entries(this.verifiers).map(
            ([issuerUrl, { audience }]) => ({
                issuer: issuerUrl,
                audience,
                customJwtCheck: this.customJwtCheck,
            }),
        );
    }

    /**
     * Returns the email verification URL based on the issuer URL.
     * @param {string} issuerUrl - The issuer URL.
     * @returns {string} The email verification URL.
     */
    getEmailVerificationUrl(issuerUrl) {
        // Getting the URL parameters string
        const urlParams = this.getUrlParamsString(issuerUrl);
        // Replacing the string to be replaced in the base URL with the URL parameters string
        return this.baseUrl.replace(this.stringToBeReplaced, urlParams);
    }

    /**
     * Returns the URL parameters string based on the issuer URL.
     * @param {string} issuerUrl - The issuer URL.
     * @returns {string} - The URL parameters string.
     */
    getUrlParamsString(issuerUrl) {
        const { stage, region } = this.extractEnvParamsFromUrl(issuerUrl);
        // Returning the region if the stage is the production stage, otherwise returning the stage and region
        return stage === this.prodStage ? region : `${stage}.${region}`;
    }

    /**
     * Extracts environment parameters from the issuer URL.
     * @param {string} issuerUrl - The issuer URL to extract parameters from.
     * @returns {Object} - An object containing the extracted region and stage parameters.
     * @throws {Error} - Throws an error if the issuer URL is not found in the verifiers object or does not match any provided patterns.
     * @throws {Error} - Throws an error if the custom extractor for the issuer URL does not return region and stage parameters.
     */
    extractEnvParamsFromUrl(issuerUrl) {
        const matchedPatternResult = this.findMatch(issuerUrl);

        if (!matchedPatternResult && !this.verifiers[issuerUrl]) {
            throw new Error(
                `Issuer URL ${issuerUrl} not found in verifiers object`,
            );
        }

        if (!matchedPatternResult) {
            throw new Error(
                `Issuer URL ${issuerUrl} does not match any provided patterns`,
            );
        }

        const { match, matcher } = matchedPatternResult;
        if (!matcher.customExtractor) {
            return this.extractRegionAndStage({
                match,
                regionExtractor: matcher.regionExtractor,
                issuerUrl,
            });
        }

        const extractedParams = matcher.customExtractor(match);
        if (!extractedParams.stage) {
            throw new Error(
                `Custom extractor for issuer URL ${issuerUrl} did not return a valid stage`,
            );
        }
        return extractedParams;
    }

    /**
     * Extracts the region and stage from the given parameters.
     * @param {Object} options - The options object.
     * @param {Object} options.match - The match object.
     * @param {Function} options.regionExtractor - The region extractor function.
     * @param {string} options.issuerUrl - The issuer URL.
     * @returns {Object} An object containing the extracted region and stage.
     */
    extractRegionAndStage({ match, regionExtractor, issuerUrl }) {
        const stage = this.getStageName(issuerUrl);
        return {
            region: regionExtractor(match, stage),
            stage,
        };
    }

    getMatchers() {
        return Object.values(this.matchers);
    }

    /**
     * Finds a match for the given issuer URL using the defined matchers.
     * @param {string} issuerUrl - The issuer URL to find a match for.
     * @returns {object|null} - An object containing the match and the corresponding matcher
     * if a match is found, or null if no match is found.
     */
    findMatch(issuerUrl) {
        const matchers = this.getMatchers();

        // Looping over the matchers to find a match for the issuer URL
        for (let i = 0; i < matchers.length; i++) {
            const matcher = matchers[i];
            const match = JwtTokenVerifiers.matchWithMatcher(
                issuerUrl,
                matcher,
            );
            if (match) {
                // Returning the match and the corresponding matcher if a match is found
                return { match, matcher };
            }
        }

        return null;
    }

    /**
     * Matches the issuer URL with a matcher.
     * @param {string} issuerUrl - The issuer URL.
     * @param {Object} matcher - The matcher.
     * @returns {Array|null} The match if found, or null if not found.
     */
    static matchWithMatcher(issuerUrl, matcher) {
        return issuerUrl.match(matcher.regex);
    }

    /**
     * Retrieves the stage name from the given issuer URL.
     * @param {string} issuerUrl - The issuer URL.
     * @returns {string} - The stage name extracted from the issuer URL.
     * @throws {Error} - If the stage in the URL is invalid.
     */
    getStageName(issuerUrl) {
        const verifier = this.verifiers[issuerUrl] ?? {};
        const stage = verifier.isProdUrl ? this.prodStage : issuerUrl;
        const match = stage.match(this.regexPatterns.STAGE_REGEX);

        if (!match) {
            throw new Error(`Invalid stage in URL: ${issuerUrl}`);
        }

        const [stageName] = match;
        return verifier.shouldTransformStageName
            ? this.stageNameTransformer(stageName)
            : stageName;
    }
}

module.exports = {
    JwtTokenVerifiersInstance: new JwtTokenVerifiers({
        verifiers: VERIFIERS,
        baseUrl: BASE_URL,
        prodStage: PROD_STAGE_NAME,
        regexPatterns: RegexPatterns,
        matchers: Matchers,
        stringToBeReplaced: StringToBeReplaced,
        customJwtCheck: CustomJwtCheck,
        stageNameTransformer: StageNameTransformer,
    }),
    JwtTokenVerifiers,
};
