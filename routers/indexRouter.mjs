import express from 'express'
import { User, Story } from '../models.mjs';

const indexRouter = express.Router();

indexRouter.get('/', async (req, res) => {

    if (req.isAuthenticated()) {

        try {
            const recentPosts = (await Story.find().sort({timestamp: -1}).populate('author')).filter(story => !story.author._id.equals(req.user._id));
            res.render('index', {user: req.user, posts: recentPosts});
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.render('index');
    }
});

indexRouter.get('/search', async (req, res) => {

    let matching_users = [];
    let matching_posts = [];

    if (req.query.find && req.query.find != '') {

        const search_query = new RegExp(req.query.find, 'i');

        try {
            matching_users = await User.find({username: search_query});
            matching_posts = await Story.find({$or: 
                [
                    {title: search_query},
                    {location: search_query},
                    {content: search_query}
                ]
            }).populate('author');
        }

        catch(error) {

            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    res.render('search', {
        users: matching_users,
        posts: matching_posts
    });
});

export default indexRouter;