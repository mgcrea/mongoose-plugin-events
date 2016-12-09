import {Schema} from 'mongoose';
import eventsPlugin from './../../src';

const schema = new Schema({
  name: {type: String, required: true},
  content: {type: Object, default: {}}
});

schema.plugin(eventsPlugin, {});

export default schema;
