import "./config.mjs";
import "./db.mjs";
import express from 'express'
import session from "express-session";
import multer from 'multer';
import mongoose from "mongoose";
import path from 'path'
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from "fs";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storageDirectory = './images'; // Specify the destination directory
const storagePath = path.join(__dirname, storageDirectory); // Create the absolute path

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

const sessionOptions = { 
	secret: 'secretCode', 
	saveUninitialized: false, 
	resave: false 
};

app.use(session(sessionOptions));

app.set('view engine', 'hbs');

app.use(express.urlencoded({extended : false}));

const User = mongoose.model('User');
const Story = mongoose.model('Story');
const Follow = mongoose.model('Follow');

app.get('/', async (req, res) => {

    if (req.session.user) {

        const bookmarked_posts = await Story.find({bookmarks: req.session.user._id});
        const liked_posts = await Story.find({likes: req.session.user._id});

        const following = (await Follow.find({following: req.session.user._id})).map(follow => follow.followed);
        const latestFollowingPosts = await Story.find({author: {$in: following}}).sort({timestamp: -1});

        res.render('index', {user: req.session.user, 
                             bookmarks: bookmarked_posts,
                             likes: liked_posts,
                             following_posts: latestFollowingPosts});
    }

    else {

        res.redirect('/login');
    }
})

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {

    const foundUser = await User.findOne({username: req.body.username});

    if (foundUser) {   
        res.render('register', {error: 'Username already taken.'});
    }

    if (req.body.pw != req.body.pwc) {
        res.render('register', {error: 'Passwords do not match.'});
    }
 
    try {
        const newUser = new User({
            username: req.body.username,
            hash: req.body.pw,
            bio: '',
            stories: [],
            following: [],
            bookmarks: []
        });

        await newUser.save();
        req.session.user = newUser;
        res.redirect('/')
    }

    catch(e) {
        res.render('register', {error : e});
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {

    try {

        const foundUser = await User.findOne({username: req.body.username});

        if (foundUser) {

            if (foundUser.hash == req.body.pw) {
                req.session.user = foundUser;
                res.redirect('/')
            }

            else {
                res.render('login', {error : "Incorrect Password"});
            }
        }

        else {
            res.render('login', {error : "User doesn't exist."})
        }
    }

    catch(e) {
        res.status(500).send("Internal Server Error");
    }
});

app.get('/logout', (req, res) => {

    req.session.destroy((err) => {

        if (err) {
          console.error('Error destroying session:', err);
        }

        res.redirect('/');
      });
})

app.get('/u/:username', async (req, res) => {

    try {

        const user = await User.findOne({username: req.params.username});
        const posts = await Story.find({author: user});
        const following = await Follow.findOne({following: req.session.user._id, followed: user._id});
        
        res.render('profile', {stories: posts,
                                own: req.session.user.username === req.params.username,
                                user: user,
                                following: following ? true : false});
    }

    catch(error) {
        console.log(error);
        res.status(500).send("Something went wrong.");
    }
});

app.get('/story/:storyID', async (req, res) => {

    if (req.session.user) {

        try {

            const story = await Story.findOne({_id : req.params.storyID});

            if (story) {

                res.render('story', {story: story, 
                                    own: req.session.user._id == story.author, 
                                    user: req.session.user,
                                    liked: story.likes.includes(req.session.user._id),
                                    bookmarked: story.bookmarks.includes(req.session.user._id)
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
        const newComment = {user: req.session.user, username: req.session.user.username, body: req.body.comment}
        const updatedStory = await Story.findOneAndUpdate({_id: req.params.storyID}, {$push: {comments: newComment}})
        res.redirect(req.path);
    }

    catch {
        res.status(500).send('Internal Server Error');
    }
})

app.use('/:imageID', express.static(path.resolve(__dirname, 'images')));

app.get('/make-post', (req, res) => {
    res.render('post');
})

app.get('/edit/:story_id', async (req, res) => {

    try {
        const foundStory = await Story.findOne({_id: req.params.story_id});

        if (foundStory && foundStory.author == req.session.user._id) {
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

        if (foundStory && foundStory.author == req.session.user._id) {
            await Story.deleteOne({_id: req.params.story_id});
        }

        res.redirect('/');
    }

    catch {
        res.status(500).send('Internal Server Error');
    }

})

app.post('/edit/:story_id', upload.array('images'), async (req, res) => {

    try {

        const foundStory = await Story.findOne({_id: req.params.story_id});
        const uploadedFiles = req.files;

        if (foundStory && foundStory.author == req.session.user._id) {

            let imageUrls = foundStory.images;

            if (uploadedFiles.length) {
                imageUrls = uploadedFiles.map(file => file.path);
            }

            const updatedDetails = {
                title: req.body.title,
                content: req.body.content,
                images: imageUrls,
                location: req.body.location,
                author: req.session.user
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

    if (req.session.user) {

        try {
            const foundStory = await Story.findOne({_id: req.params.story_id});

            if (foundStory) {

                if (foundStory.likes.includes(req.session.user._id)) {
                    await Story.findOneAndUpdate({_id: req.params.story_id}, {$pull: {likes: req.session.user._id}});
                }

                else {
                    await Story.findOneAndUpdate({_id: req.params.story_id}, {$push: {likes: req.session.user}})
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

    if (req.session.user) {

        try {
            const foundStory = await Story.findOne({_id: req.params.story_id});

            if (foundStory) {

                if (foundStory.bookmarks.includes(req.session.user._id)) {
                    await Story.findOneAndUpdate({_id: req.params.story_id}, {$pull: {bookmarks: req.session.user._id}});
                }

                else {
                    await Story.findOneAndUpdate({_id: req.params.story_id}, {$push: {bookmarks: req.session.user}})
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

    if (req.session.user) {

        try {

            const following = req.session.user;
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

            res.redirect(`/u/${followed.username}`);
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
      const imageUrls = uploadedFiles.map(file => file.path);
  
      // Create a new story document with the image URLs
      const newStory = new Story({

        title: req.body.title, // Assuming you have a title field in your form
        content: req.body.content, // Assuming you have a content field in your form
        images: imageUrls, // Store the URLs to the images as an array
        location: req.body.location, // Assuming you have a location field in your form
        author: req.session.user,
      });
  
      const savedStory = await newStory.save();
      res.redirect(`/story/${savedStory._id}`);
  
    } catch (error) {
      console.error(error);
      res.status(500).send('Error saving the story.');
    }
  });

app.get('/:username/edit', (req, res) => {

    if (req.session.user.username != req.params.username) {
        res.redirect('/');
    }

    res.render('profile_edit', {user: req.session.user});
})

app.post('/:username/edit', async (req, res) => {

    if (req.session.user.username == req.body.username) {

        if (req.session.user.bio != req.body.bio) {

            await User.findOneAndUpdate({username: req.session.user.username}, {bio: req.body.bio});
            req.session.user = await User.findOne({username: req.session.user.username});
        }
        
        res.redirect('/');
    }

    else {

        const foundUser = await User.findOne({username: req.body.username});

        if (foundUser) {
            res.render('profile_edit', {error: 'Username already taken.'});
        }

        else {

            if (req.body.pw) {

                if (req.session.user.hash == req.body.pw) {

                    await User.findOneAndUpdate({username: req.session.user.username}, {username: req.body.username});
                    req.session.user = await User.findOne({username: req.body.username});
                    res.redirect('/');
                }

                else {
                    res.render('profile_edit', {error: 'Incorrect Password.'});
                }
            }

            else {
                res.render('profile_edit', {error: 'Enter your password to change username.'});
            }
        }
    }
});

app.listen(process.env.PORT ?? 3000);
