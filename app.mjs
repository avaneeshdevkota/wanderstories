import express from 'express'
import path from 'path'
import "./config.mjs";
import "./schemas.mjs";
import "./hbs_helpers.mjs"
import "./defaults.mjs"
import { DIRNAME, SERVE_FROM} from './defaults.mjs';

import indexRouter from './routers/userRouter.mjs';
import userRouter from './routers/indexRouter.mjs';
import storyRouter from './routers/storyRouter.mjs';

const app = express();
app.set('view engine', 'hbs');

app.use(express.urlencoded({extended : false}));
app.use(express.static(path.resolve(DIRNAME, SERVE_FROM)));

app.use(indexRouter);
app.use(storyRouter);
app.use(userRouter);

app.listen(process.env.PORT ?? 3000);