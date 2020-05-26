# What's this
This is pretty simple tool that helps you with caching mongoose queries to mongoDB.

It exsposes
```
.cache(options?)
```
method for all mongoose queries

and also adds separate method for clearing cache
```
clearCache(cacheGroup?)
```

# Usage

## Install
```
npm i --save redis_mongoose
```

## Initialize

```
const redisMongoose = require('redis_mongoose');
```
In your main file (usualy src/index.js)
Usually you already have instance of Mongoose imported in this file, if not, add it with
```
const mongoose = require('mongoose');
```

Now execute init function, passing in Mongoose instance and optionally Redis adress, by default local redis runs on 'redis://127.0.0.1:6379', this value will be used by default.

```
redisMongoose.init(mongoose);
```
Thats all. Now you can just add
```
.cache(options?)
```
to your queries and the app will do its job.

### Example
I have some api, it assepts user.id, looks in database for that user's blogs and returns the result.
Insted of punching DB with the exact same request I can do just one request to DB, cache it and then return cached value for every same request.

```
app.get('/api/blogs', requireLogin, async (req, res) => {
        const blogs = await Blog.find({ _user: req.user.id }).cache();

        res.send(blogs);
    });
```

In this case the cache will be stored forever, so in order to keep things working it is crucual to clean cache manualy in some cases. In this case I must clear chashe when new blog is posted, so I will do it in respected api controller.
```
const { clearCache } = require('redis_mongoose');
app.post('/api/blogs', async (req, res) => {
        <!-- some work on putting stuff to db, validatind etc -->
        clearCache();
        <!-- clear cach afterwards -->
    });

```

# Options
There are some options to help you fine-tune your caching strategy

```
.cache({
    customKey?,
    cacheGroup?,
    ttl?,
  })
```
*cacheKey* is key for field, can be empty so uniq hash from queryAnd CollectionName will be made

                  *REDIS STORE*
              |__________|__________|
              |__________|__________|
              |_cacheKey_|_{result}_|
              |__________|__________|

*cacheGroupKey* allows you to group fieds

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

*ttl* is how long in seconds cache for group will live, by default it will live forever

                  *REDIS STORE*
                    (ttl=60)

              |__default__| <-- will be deleted after 60 seconds
                          |___....___|___....___|
                          |___....___|___....___|
                          |_cacheKey_|_{result}_|
                          |___....___|___....___|

