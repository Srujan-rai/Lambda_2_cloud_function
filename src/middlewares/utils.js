const cache = {};

const getCache = (key) => {
    if (!cache[key]) return {};
    return cache[key];
};

const processCache = (options, fetch = () => undefined, request, notCacheEmpty) => {
    const { cacheExpiry, cacheKey } = options;
    const cached = getCache(cacheKey);
    const unexpired = cached.expiry && (cacheExpiry < 0 || cached.expiry > Date.now());
    if (unexpired) {
        return {
            ...cached,
            cache: true,
        };
    }
    const value = fetch(request);

    if (notCacheEmpty && (!value || (Array.isArray(value) && !value.length))) {
        return { value };
    }

    const expiry = Date.now() + cacheExpiry;
    cache[cacheKey] = {
        value,
        expiry,
    };

    return {
        value,
    };
};

module.exports = {
    processCache,
};
