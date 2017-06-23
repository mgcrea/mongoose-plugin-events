
import expect from 'expect';
import mongoose from 'mongoose';

import testSchema from './../fixtures/schema';
import pkg from './../../package.json';

import eventsPlugin from './../../src';

describe('Plugin', () => {
  const mongoUri = process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/test-${pkg.name}`;
  mongoose.set('debug', true);
  const db = mongoose.createConnection(mongoUri);
  const Model = db.model('Foo', testSchema);

  before(() => Promise.all([
    Model.remove({})
  ]));
  it('constructor should export a function', () => {
    expect(eventsPlugin).toBeA('function');
  });
  it('should properly save one document', () => {
    const orig = {name: 'TestSave', content: {foo: 'bar'}};
    // @TODO
    // Model.schema.on('doc:created', (doc) => {
    //   d('shcema created!!!');
    // });
    // db.model('Foo').on('created', (doc) => {
    //   d('created!!!');
    // });
    return Model.create(orig)
      .then((doc) => {
        expect(doc.content).toEqual(orig.content);
        return Model.findOne({_id: doc.id});
      })
      .then((doc) => {
        expect(doc.content).toEqual(orig.content);
      });
  });
  it('should properly support document update', () => {
    // @TODO
    // Model.schema.on('doc:updated', (doc) => {
    //   d('shcema updated!!!');
    // });
    // db.model('Foo').on('updated', (doc) => {
    //   d('updated!!!');
    // });
    const patch = {name: 'TestSave', content: {foo: 'baz'}};
    return Model.update({name: 'TestSave'}, patch)
      .then((doc) => {
        expect(doc.ok).toEqual(1);
        expect(doc.n).toEqual(1);
        return Model.findOne({name: 'TestSave'});
      })
      .then((doc) => {
        expect(doc.content).toEqual(patch.content);
      });
  });
  // eslint-disable-next-line
  it('should properly support document remove', () => {
    // @TODO
    // Model.schema.on('doc:removed', (doc) => {
    //   d('schema removed!!!');
    // });
    // db.model('Foo').on('removed', (doc) => {
    //   d('removed!!!');
    // });
    return Model.findOne({name: 'TestSave'})
      .then(doc => doc.remove())
      .then((doc) => {
        expect(!!doc).toBeTruthy();
      });
  });
});
