import mongoose, { Mongoose } from "mongoose";
import passportLocalMongoose from "passport-local-mongoose"

mongoose.connect(process.env.DSN);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
});

userSchema.plugin(passportLocalMongoose); 
const User = mongoose.model('User', userSchema);

const commentSchema = new mongoose.Schema({

  story: {type: mongoose.Schema.Types.ObjectId, ref: 'Story'},
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username : {type: String},
  body: String,
  timestamp: { type: Date, default: Date.now }
});

const Comment = mongoose.model('Comment', commentSchema);

const storySchema = new mongoose.Schema({

  title: { type: String, required: true },
  content: { type: String, required: true },
  images: [{ type: String }],
  location: { type: String },
  timestamp: { type: Date, default: Date.now },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
});

const Story = mongoose.model('Story', storySchema);

const followSchema = new mongoose.Schema({

  following: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  followed: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

})

const Follow = mongoose.model('Follow', followSchema);