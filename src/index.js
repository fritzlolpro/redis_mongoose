const mongoose = require('mongoose');
const redis = require('redis');
const { promisify } = require('util');
const crypto = require('crypto');

const { exec } = mongoose.Query.prototype;

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
client.hget = promisify(client.hget);

// eslint-disable-next-line func-names
mongoose.Query.prototype.cache = function (options = {}) {
    this.useCache = true;

    this.cacheGroupKey = JSON.stringify(options.cacheGroup || 'default');
    this.cacheKey = options.key ? JSON.stringify(options.key) : null;
    this.ttl = options.ttl ? options.ttl : null;

    return this;
};

// eslint-disable-next-line func-names
mongoose.Query.prototype.exec = async function () {
    if (!this.useCache) {
        const result = await exec.apply(this, arguments);
        return result;
    }

    const key = JSON.stringify({ ...this.getQuery(), collection: this.mongooseCollection.name });

    // see if have val for key in redis and if ye than return it
    const cacheValue = await client.hget(this.cacheKey, key);
    // if no, punch mongo and return it and store things in redis
    if (cacheValue) {
        // const doc = new this.model(JSON.parse(cacheValue));

        const doc = JSON.parse(cacheValue);
        console.log('GONNA from cache');
        return Array.isArray(doc)
            ? doc.map((d) => this.model(d))
            : new this.model(doc);
    }
    console.log('GONNA from DB');
    const result = await exec.apply(this, arguments);

    // client.hmset(this.cacheKey, key, JSON.stringify(result), 'EX', 10);
    client.hset(this.cacheKey, key, JSON.stringify(result));
    console.log('save to DB', this.cacheKey, key);
    return result;
};

module.exports = {
    clearHash(key) {
        console.log('clear chach', key);
        client.del(JSON.stringify(key || 'default'));
    },
};
