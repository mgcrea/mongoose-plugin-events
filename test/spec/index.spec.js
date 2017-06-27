
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

  beforeAll(() => Promise.all([
    Model.remove({})
  ]));
  it('constructor should export a function', () => {
    expect(eventsPlugin).toBeA('function');
  });
  it('should properly save one document', () => {
    // Bind events
    const documentSpy = jest.fn();
    Model.on('created', documentSpy);
    const schemaSpy = jest.fn();
    Model.schema.on('model:created', schemaSpy);
    // Actually create document
    const orig = {name: 'TestSave', content: {foo: 'bar'}};
    return Model.create(orig)
      .then((doc) => {
        expect(doc.content).toEqual(orig.content);
        return Model.findOne({_id: doc.id});
      })
      .then((doc) => {
        expect(doc.content).toEqual(orig.content);
        expect(documentSpy.mock.calls.length).toBe(1);
        expect(documentSpy.mock.calls[0][0]).toEqual(doc.toObject());
        expect(schemaSpy.mock.calls.length).toBe(1);
        expect(schemaSpy.mock.calls[0][0]).toEqual(doc.toObject());
      });
  });
  it('should properly support document update', () => {
    // Bind events
    const documentSpy = jest.fn();
    Model.on('updated', documentSpy);
    const schemaSpy = jest.fn();
    Model.schema.on('model:updated', schemaSpy);
    // Actually patch document
    const query = {name: 'TestSave'};
    const patch = {name: 'TestSave', content: {foo: 'baz'}};
    return Model.update(query, patch)
      .then((doc) => {
        expect(doc.ok).toEqual(1);
        expect(doc.n).toEqual(1);
        return Model.findOne({name: 'TestSave'});
      })
      .then((doc) => {
        expect(doc.content).toEqual(patch.content);
        expect(documentSpy.mock.calls.length).toBe(1);
        expect(documentSpy.mock.calls[0][0]).toEqual({query, update: patch});
        expect(schemaSpy.mock.calls.length).toBe(1);
        expect(schemaSpy.mock.calls[0][0]).toEqual({query, update: patch});
      });
  });
  it('should properly support document remove', () => {
    // Bind events
    const documentSpy = jest.fn();
    Model.on('removed', documentSpy);
    const schemaSpy = jest.fn();
    Model.schema.on('model:removed', schemaSpy);
    // Actually remove document
    return Model.findOne({name: 'TestSave'})
      .then(doc => doc.remove())
      .then((doc) => {
        expect(!!doc).toBeTruthy();
        expect(documentSpy.mock.calls.length).toBe(1);
        expect(documentSpy.mock.calls[0][0]).toEqual(doc.toObject());
        expect(schemaSpy.mock.calls.length).toBe(1);
        expect(schemaSpy.mock.calls[0][0]).toEqual(doc.toObject());
      });
  });
});
