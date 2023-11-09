import mongoose, { Mongoose } from "mongoose";
import passportLocalMongoose from "passport-local-mongoose"

mongoose.connect(process.env.DSN);

const userSchema = new mongoose.Schema({

  // Unique username for the user, used for authentication
  username: { type: String, required: true, unique: true },

  // Bio to display on user profile
  bio: { type: String, required: false},
  
  // List of users that the current user is following
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  stories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Story' }],
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Story' }]

});

userSchema.plugin(passportLocalMongoose); 
const User = mongoose.model('User', userSchema);

const commentSchema = new mongoose.Schema({

  // User who made the comment, referencing the User entity
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  username : {type: String},

  // The textual content of the comment
  body: String,

  // Timestamp indicating when the comment was made (default: current date and time)
  timestamp: { type: Date, default: Date.now }

});

const storySchema = new mongoose.Schema({

  // Title of the travel story, a required field
  title: { type: String, required: true },

  // Main content of the travel story, a required field
  content: { type: String, required: true },

  // Array of image URLs associated with the story
  images: [{ type: String }],

  // Location tied to the story
  location: { type: String },

  // Timestamp indicating when the story was created (default: current date and time)
  timestamp: { type: Date, default: Date.now },

  // Author of the story, referencing the User entity
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Users who have liked the story, referencing User entities
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Users who have bookmarked the story, referencing User entities
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Comments associated with the story, an array of embedded comment documents
  comments: [commentSchema]
});

const Story = mongoose.model('Story', storySchema);

const followSchema = new mongoose.Schema({

  following: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  followed: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

})

const Follow = mongoose.model('Follow', followSchema);
