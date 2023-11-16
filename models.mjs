import mongoose from "mongoose";

export const User = mongoose.model('User');
export const Story = mongoose.model('Story');
export const Comment = mongoose.model('Comment');
export const Follow = mongoose.model('Follow');
