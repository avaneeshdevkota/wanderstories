import "./config.mjs";
import "./db.mjs";
import express from 'express'
import session from "express-session";
import multer from 'multer';
import mongoose from "mongoose";
import path from 'path'
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from "fs";
import passport from "passport";
import { Strategy as LocalStrategy } from 'passport-local';
import Handlebars from 'handlebars';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storageDirectory = './public/uploads'; // Specify the destination directory
const storagePath = path.join(__dirname, storageDirectory); // Create the absolute path

const User = mongoose.model('User');
const Comment = mongoose.model('Comment');
const Story = mongoose.model('Story');
const Follow = mongoose.model('Follow');

// Ensure the destination directory exists or create it if necessary

if (!existsSync(storagePath)) {
    mkdirSync(storagePath, { recursive: true }); // Create the directory recursively
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, storageDirectory);
  },
  filename: (req, file, cb) => {
    const extArray = file.mimetype.split('/');
    const extension = extArray[extArray.length - 1];
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.originalname.split('.')[0] + '-' + uniqueSuffix + '.' + extension);
  },
});

const upload = multer({ storage: storage });

app.set('view engine', 'hbs');

Handlebars.registerHelper('equals', function (arg1, arg2, options) {
    return arg1.equals(arg2) ? options.fn(this) : options.inverse(this);
});

app.use(express.urlencoded({extended : false}));
app.use(express.static(path.resolve(__dirname, 'public')));

app.use(session({

    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/', async (req, res) => {

    if (req.isAuthenticated()) {

        const recentPosts = (await Story.find().sort({timestamp: -1}).populate('author')).filter(story => !story.author._id.equals(req.user._id));
        res.render('index', {user: req.user, posts: recentPosts});
    }

    else {
        res.render('index');
    }
});

app.get('/following', async (req, res) => {

    if (req.isAuthenticated()) {

        const following = (await Follow.find({following: req.user._id})).map(follow => follow.followed);
        const latestFollowingPosts = await Story.find({author: {$in: following}}).sort({timestamp: -1}).populate('author');
        res.render('following', {posts: latestFollowingPosts});
    }

    else {
        res.redirect('/');
    }
});

app.get('/search', async (req, res) => {

    if (req.isAuthenticated()) {

        let matching_users = [];
        let matching_posts = [];

        if (req.query.find && req.query.find != '') {

            const search_query = new RegExp(req.query.find, 'i');

            matching_users = await User.find({username: search_query});

            matching_posts = await Story.find({$or: [
                {title: search_query},
                {location: search_query},
                {content: search_query}
            ]}).populate('author');
        }

        res.render('search', {users: matching_users,
                              posts: matching_posts
                             });
    }

    else {
        res.redirect('/');
    }
})

app.get('/you', async (req, res) => {

    if (req.isAuthenticated()) {
        res.redirect(`/u/${req.user._id}`)
    }

    else {
        res.redirect('/');
    }
})

app.get('/bookmarked', async (req, res) => {

    if (req.isAuthenticated()) {

        const bookmarked_posts = await Story.find({bookmarks: req.user._id}).populate('author');
        res.render('bookmarks', {bookmarks: bookmarked_posts});
    }

    else {
        res.redirect('/');
    }
})

app.get('/liked', async (req, res) => {

    if (req.isAuthenticated()) {

        const liked_posts = await Story.find({likes: req.user._id}).populate('author');
        res.render('likes', {likes: liked_posts});
    }

    else {
        res.redirect('/');
    }
})

app.get('/register', (req, res) => {
    res.render('register');
});

app.post("/register", async (req, res) => {

    if (req.body.password !== req.body.pwc) {
        res.render('register', {error : "Passwords do not match."});
    }

    else {
        
        const search_query = new RegExp(`^${req.body.username}$`, 'i');
        const foundUser = await User.findOne({username: search_query});

        if (foundUser) {
            res.render('register', {error : "User already exists."});
        }

        else {

            User.register(new User({username: req.body.username,
                                    bio: '',
                                    stories: [],
                                    following: [],
                                    bookmarks: []
                                }), req.body.password, function(err, user) {
                if(err) {
                    console.log(err);
                    res.redirect('/register');
                }

                passport.authenticate("local")(req, res, function(){
                    res.redirect("/");
                });
            });
        }
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', function(req, res, next) {

    passport.authenticate('local', function(err, user, info) {
      if (err) { return next(err) }
      if (!user) {
        return res.render('login', { error : info.message + '.' })
      }

      req.login(user, function(err) {
        if (err) { return next(err); }
        return res.redirect('/');
      });
    })(req, res, next);
  });

app.get('/logout', (req, res) => {

    req.logout((err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

app.get('/u/:userID', async (req, res) => {

    try {

        const user = await User.findOne({_id: req.params.userID});
        const posts = await Story.find({author: user}).populate('author');
        const following = await Follow.findOne({following: req.user._id, followed: user._id});
        const numFollowing = (await Follow.find({following: user._id})).length;
        const numFollowers = (await Follow.find({followed: user._id})).length;
    
        res.render('profile', {stories: posts,
                                own: req.user._id.equals(req.params.userID),
                                user: user,
                                following: following ? true : false,
                                numFollowing: numFollowing,
                                numFollowers: numFollowers});
    }

    catch(error) {
        console.log(error);
        res.status(500).send("Something went wrong.");
    }
});

app.get('/story/:storyID', async (req, res) => {

    if (req.isAuthenticated()) {

        try {

            const story = await Story.findOne({_id: req.params.storyID})

            if (story) {

                const poster = await User.findOne({_id: story.author});
                const comments = await Comment.find({story: story._id});

                res.render('story', {story: story,
                                     poster: poster,
                                     own: req.user._id.equals(story.author),
                                     user: req.user,
                                     liked: story.likes.includes(req.user._id),
                                     bookmarked: story.bookmarks.includes(req.user._id),
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
    }
});

app.post('/story/:storyID', async (req, res) => {

    try {
        const newComment = new Comment(
            {story: req.params.storyID,
             user: req.user,
             username: req.user.username,
             body: req.body.comment});

        await newComment.save();
        res.redirect(req.path);
    }

    catch(err) {
        console.log(err);
        res.status(500).send('Internal Server Error');
    }
})

app.get('/make-post', (req, res) => {
    
    if (req.isAuthenticated()) {
        res.render('post');
    }
    else {
        res.redirect('/');
    }
})

app.get('/edit/:story_id', async (req, res) => {

    try {
        const foundStory = await Story.findOne({_id: req.params.story_id}).populate('author');

        if (foundStory && req.user._id.equals(foundStory.author._id)) {
            res.render('post_edit', {story: foundStory});
        } 
    }

    catch {
        res.status(500).send('Internal Server Error.');
    }
})


app.get('/delete/:story_id', async (req, res) => {

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

    catch {
        res.status(500).send('Internal Server Error');
    }

})

app.post('/edit/:story_id', upload.array('images'), async (req, res) => {

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
    }

    catch(error) {
        console.log(error);
        res.status(500).send('Internal Server Error.');
    }
})

app.get('/like/:story_id', async (req, res) => {

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
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error');
        }
    }
});

app.get('/bookmark/:story_id', async (req, res) => {

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
        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error');
        }
    }
})

app.get('/follow/:user_id', async (req, res) => {

    if (req.isAuthenticated()) {

        try {

            const following = req.user;
            const followed = await User.findOne({_id: req.params.user_id});

            if (followed) {

                const existingFollow = await Follow.findOne({following: following._id, followed: followed._id});

                if (existingFollow) {
                    await Follow.deleteOne(existingFollow);
                }

                else { 
                    const newFollow = new Follow({
                        following: following,
                        followed: followed
                    });

                    await newFollow.save();
                }
            }

            res.redirect(`/u/${followed._id}`);
        }

        catch(error) {

            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }

    else {
        res.redirect('/login');
    }
});

app.post('/make-post', upload.array('images'), async (req, res) => {
    
    const uploadedFiles = req.files;

    try { 
      // Save the image file URLs to an array
      
      const imageUrls = uploadedFiles.map(file => `/uploads/${file.filename}`);
  
      // Create a new story document with the image URLs
      const newStory = new Story({

        title: req.body.title, // Assuming you have a title field in your form
        content: req.body.content, // Assuming you have a content field in your form
        images: imageUrls, // Store the URLs to the images as an array
        location: req.body.location, // Assuming you have a location field in your form
        author: req.user,
      });
  
      const savedStory = await newStory.save();
      res.redirect(`/story/${savedStory._id}`);
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Error saving the story.');
    }
  });

app.get('/delete', async (req, res) => {

    if (req.isAuthenticated()) {
        
        try {
            await User.deleteOne({_id: req.user._id});
            res.redirect('/logout');

        }

        catch(error) {
            console.log(error);
            res.status(500).send('Internal Server Error.');
        }
    }
})

app.get('/delete/comment/:commentID', async (req, res) => {

    try {
        const deleteComment = await Comment.findOne({_id: req.params.commentID});

        if (deleteComment) {

            const redirectTo = deleteComment.story;
            await Comment.deleteOne({_id: req.params.commentID});
            res.redirect(`/story/${redirectTo}`)
        }

        else {
            res.status(500).send('InternaL Server Erorr');
        }
    }

    catch(err) {
        console.log(err);
        res.status(500).send('InternaL Server Erorr');
    }
})

app.listen(process.env.PORT ?? 3000);
