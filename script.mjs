import "./config.mjs";
import "./schemas.mjs";
import mongoose from "mongoose";
import {faker} from "@faker-js/faker";
import axios from "axios";
import { User, Story, Comment, Follow } from "./models.mjs";

mongoose.connect(process.env.DSN);

const dropCollection = async(model) => {

    try {
        await model.collection.drop();
        console.log(`Dropped ${model.collection.collectionName} collection`);
    }
    
    catch (error) {
      console.error(`Error dropping ${model.collection.collectionName} collection:`, error);
    }
};

const dropCollections = async() => {

    await dropCollection(User);
    await dropCollection(Story);
    await dropCollection(Comment);
    await dropCollection(Follow);
}

await dropCollections();

const generateUsers = (numUsers) => {
    
    const users = [];
    for (let i = 0; i < numUsers; i++) {
        const user = new User({
            username: faker.internet.userName(),
        });
        
        users.push(user);
    }

    return users;
};

const getRandomImageUrl = async (query) => { 
    
    try {
        const response = await axios.get(`https://source.unsplash.com/random/?${query}`);
        return response.request.res.responseUrl;
    }
    
    catch (error) {
        console.error('Error fetching random image:', error);
        return null;
    }
};

const generateStories = async (users) => {
    
    const stories = [];
    const titles = ['48 Hours in NYC', 'Delightful Tokyo', 'Hidden Gems of Santorini', "Unwinding on Maui's Beaches",
                    'Conquering the Trails of the Swiss Alps', 'Jolly in Jaipur', 'Pampering Yourself in the Maldives',
                    'Kruger National Park', 'Pacific Coast Highway by Car', 'Heritage Sites of Rome'];

    const locations = ['New York City, USA', 'Tokyo, Japan', 'Santorini, Greece', 'Maui, Hawaii', 'Swiss Alps', 'Jaipur, India',
                       'Maldives', 'South Africa', 'California, USA', 'Rome, Italy'];

    for (let i = 0; i < 10; i++) {

        let post_images = [];
        const num_images = Math.floor(((Math.random() + 1) * 5))
        
        for (let j = 0; j < num_images; j++) {
            post_images.push(await getRandomImageUrl(locations[i].replace(' ', '')));
        }

        const user = users[Math.floor(Math.random() * users.length)];
        const story = new Story({
            title: titles[i],
            content: faker.lorem.paragraphs(),
            images: post_images,
            location: locations[i],
            author: user._id,
      });

      stories.push(story);
    }

    return stories;
};

const saveUsers = async(users) => {

    for (const user of users) {
        await User.register(new User(user), 'pass1234');
    }
}

const saveStories = async(stories) => {

    for (const story of stories) {
        await (new Story(story)).save();
    }
}

const users = generateUsers(10);
const stories = await generateStories(users);

await saveUsers(users);
await saveStories(stories);

mongoose.disconnect();