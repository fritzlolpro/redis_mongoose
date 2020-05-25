const redis = require('redis');
const { promisify } = require('util');
const crypto = require('crypto');

let client = null;

module.exports = {
    init(mongoose, redisAdress) {
        const { exec } = mongoose.Query.prototype;
        const redisUrl = redisAdress || 'redis://127.0.0.1:6379';
        client = redis.createClient(redisUrl);
        client.hget = promisify(client.hget);

        mongoose.Query.prototype.cache = function (options = {
            customKey: null,
            cacheGroup: 'default',
            ttl: null,
        }) {
            this.useCache = true;
            // cacheKey is key for field, can be empty so uniq hash from queryAnd CollectionName will be made
            /*
                  *REDIS STORE*
              |__________|__________|
              |__________|__________|
              |_cacheKey_|_{result}_|
              |__________|__________|
            */

            // cacheGroupKey allows you to group fieds
            /*
                *REDIS STORE*

                |__default__|
                            |___....___|___....___|
                            |___....___|___....___|
                            |_cacheKey_|_{result}_|
                            |___....___|___....___|
                |___user1___|
                            |___....___|___....___|
                            |__blogs___|_{result}_|
                            |__tweets__|_{result}_|
                            |___x40a___|_{result}_|

            */

            // ttl is how long in seconds cache for group will live, vy default it will live forever
            /*
                *REDIS STORE*
                ttl=60

                |__default__| <-- will be deleted after 60 seconds
                            |___....___|___....___|
                            |___....___|___....___|
                            |_cacheKey_|_{result}_|
                            |___....___|___....___|

            */


            this.cacheKey = options.customKey ? JSON.stringify(options.customKey) : null;
            this.cacheGroupKey = JSON.stringify(options.cacheGroup || 'default');
            this.ttl = options.ttl;

            return this;
        };

        mongoose.Query.prototype.exec = async function () {
            if (!this.useCache) {
                const result = await exec.apply(this, arguments);
                return result;
            }

            const field = this.cacheKey || crypto.createHash('md5').update(JSON.stringify({ ...this.getQuery(), collection: this.mongooseCollection.name })).digest('hex');
            const cacheValue = await client.hget(this.cacheGroupKey, field);
            if (cacheValue) {
                const doc = JSON.parse(cacheValue);
                return Array.isArray(doc)
                    ? doc.map((d) => this.model(d))
                    : new this.model(doc);
            }
            const result = await exec.apply(this, arguments);

            client.hset(this.cacheGroupKey, field, JSON.stringify(result));

            if (this.ttl) {
                client.expire(this.cacheGroupKey, this.ttl);
            }

            return result;
        };
    },

    clearCache(cacheGroup = 'default') {
        if (client) {
            client.del(JSON.stringify(cacheGroup));
        }
    },
};
