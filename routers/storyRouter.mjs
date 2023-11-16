import express from 'express'
import { User, Story, Comment } from '../models.mjs';
import { UPLOAD } from '../defaults.mjs';

const storyRouter = express.Router();

storyRouter.get('/story/:storyID', async (req, res) => {

    try {
        const story = await Story.findOne({_id: req.params.storyID})
        
        if (story) {

            const poster = await User.findOne({_id: story.author});
            const comments = await Comment.find({story: story._id});
            
            res.render('story', {

                story: story,
                poster: poster,
                own: req.user ? req.user._id.equals(story.author) : false,
                user: req.user,
                liked: req.user ? story.likes.includes(req.user._id) : false,
                bookmarked: req.user ? story.bookmarks.includes(req.user._id) : false,
                comments: comments
            });
        }
        
        else {
            res.send("Oops! Can't find that story.");
        }
    }
    
    catch(error) {
        console.log(error);
        res.status(500).send('Internal Server Error.');
    }
});

storyRouter.post('/story/:storyID', async (req, res) => {

    if (req.isAuthenticated()) {

        try {
            const newComment = new Comment({
                story: req.params.storyID,
                user: req.user,
                username: req.user.username,
                body: req.body.comment
            });
            
            await newComment.save();
            res.redirect(req.path);
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error');
        }
    }

    else {
        res.redirect('/');
    }
});

storyRouter.get('/make-post', (req, res) => {
    
    if (req.isAuthenticated()) {
        res.render('post');
    }

    else {
        res.redirect('/');
    }
});

storyRouter.post('/make-post', UPLOAD.array('images'), async (req, res) => {

    if (req.isAuthenticated()) {

        const uploadedFiles = req.files;

        try { 
            const imageUrls = uploadedFiles.map(file => `/uploads/${file.filename}`);
            const newStory = new Story({
                title: req.body.title, 
                content: req.body.content,
                images: imageUrls,
                location: req.body.location,
                author: req.user,
            });
            
            const savedStory = await newStory.save();
            res.redirect(`/story/${savedStory._id}`);
        }
        
        catch (error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.redirect('/');
    }
});

storyRouter.get('/edit/:story_id', async (req, res) => {

    if (req.isAuthenticated()) {

        try {
            const foundStory = await Story.findOne({_id: req.params.story_id}).populate('author');

            if (foundStory && req.user._id.equals(foundStory.author._id)) {
                res.render('post_edit', {story: foundStory});
            } 
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.redirect('/');
    }
});

storyRouter.post('/edit/:story_id', UPLOAD.array('images'), async (req, res) => {
    
    if (req.isAuthenticated()) {
        
        try {

            const foundStory = await Story.findOne({_id: req.params.story_id});
            const uploadedFiles = req.files;

            if (foundStory && req.user._id.equals(foundStory.author)) {

                let imageUrls = foundStory.images;

                if (uploadedFiles.length) {
                    imageUrls = uploadedFiles.map(file => `/uploads/${file.filename}`);
                }

                const updatedDetails = {

                    title: req.body.title,
                    content: req.body.content,
                    images: imageUrls,
                    location: req.body.location,
                    author: req.user
                }

                await Story.findOneAndUpdate({_id: req.params.story_id}, updatedDetails);
                res.redirect(`/story/${req.params.story_id}`)
            }
            
            else {
                res.redirect('/');
            }
        }
        
        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.redirect('/');
    }
});

storyRouter.get('/delete/:story_id', async (req, res) => {

    if (req.isAuthenticated()) {

        try {
            const foundStory = await Story.findOne({_id: req.params.story_id});

            if (foundStory && req.user._id.equals(foundStory.author)) {
                await Story.deleteOne({_id: req.params.story_id});
                res.redirect(`/u/${req.user._id}`);
            }

            else {
                res.redirect('/');
            }
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error');
        }
    }
    
    else {
        res.redirect('/');
    }
});

storyRouter.get('/like/:story_id', async (req, res) => {

    if (req.isAuthenticated()) {

        try {
            const foundStory = await Story.findOne({_id: req.params.story_id});
            
            if (foundStory) {

                if (foundStory.likes.includes(req.user._id)) {
                    await Story.findOneAndUpdate({_id: req.params.story_id}, {$pull: {likes: req.user._id}});
                }
                
                else {
                    await Story.findOneAndUpdate({_id: req.params.story_id}, {$push: {likes: req.user}})
                }
                
                res.redirect(`/story/${req.params.story_id}`)
            }

            else {
                res.redirect('/');
            }
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error');
        }
    }

    else {
        res.redirect('/');
    }
});

storyRouter.get('/bookmark/:story_id', async (req, res) => {
    
    if (req.isAuthenticated()) {

        try {

            const foundStory = await Story.findOne({_id: req.params.story_id});

            if (foundStory) {

                if (foundStory.bookmarks.includes(req.user._id)) {
                    await Story.findOneAndUpdate({_id: req.params.story_id}, {$pull: {bookmarks: req.user._id}});
                }
                
                else {
                    await Story.findOneAndUpdate({_id: req.params.story_id}, {$push: {bookmarks: req.user}})
                }

                res.redirect(`/story/${req.params.story_id}`)
            }

            else {
                res.redirect('/');
            }
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error');
        }
    }

    else {
        res.redirect('/');
    }
});

storyRouter.get('/delete/comment/:commentID', async (req, res) => {

    if (req.isAuthenticated()) {
    
        try {

            const deleteComment = await Comment.findOne({_id: req.params.commentID, user: req.user});

            if (deleteComment) {

                const redirectTo = deleteComment.story;
                await Comment.deleteOne({_id: req.params.commentID});
                res.redirect(`/story/${redirectTo}`)
            }

            else {
                res.redirect('/');
            }
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error');
        }
    }

    else {
        res.redirect('/');
    }
});

export default storyRouter;