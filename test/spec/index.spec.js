import expect from 'expect';
import mongoose from 'mongoose';
import Promise from 'bluebird';
import publishDebugGlobals from 'debug-utils';

import testSchema from './../fixtures/schema';
import pkg from './../../package.json';

import eventsPlugin from './../../src';

mongoose.Promise = Promise;
publishDebugGlobals();

describe('Plugin', () => {
  const mongoUri = process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/test-${pkg.name}`;
  mongoose.set('debug', true);
  const db = mongoose.createConnection(mongoUri);
  const Model = db.model('Foo', testSchema);

  beforeAll(() => Promise.all([Model.remove({})]));
  it('constructor should export a function', () => {
    expect(typeof eventsPlugin).toBe('function');
  });
  it('should properly save one document', () => {
    // Bind events
    const documentSpy = jest.fn();
    Model.on('created', documentSpy);
    const schemaSpy = jest.fn();
    Model.schema.on('model:created', schemaSpy);
    const fieldSpy = jest.fn();
    Model.on('updated:content', fieldSpy);
    // Actually create document
    const orig = {name: 'TestSave', content: {foo: 'bar'}};
    const patch = {content: {foo: 'bar2'}};
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
        doc.set('content', patch.content);
        return doc.save();
      })
      .then((doc) => {
        expect(fieldSpy.mock.calls.length).toBe(1);
        const query = {_id: doc._id};
        expect(fieldSpy.mock.calls[0][0]).toEqual({
          operator: '$set',
          query,
          update: {_id: query._id, content: patch.content}
        });
      });
  });
  it('should properly support document update via save() function', () => {
    // Bind events
    const documentSpy = jest.fn();
    Model.on('updated', documentSpy);
    const schemaSpy = jest.fn();
    Model.schema.on('model:updated', schemaSpy);
    const fieldSpy = jest.fn();
    Model.on('updated:name', fieldSpy);
    // Actually patch document
    const query = {};
    const patch = {name: 'TestSave2', content: {foo: 'baz'}};
    return Model.findOne()
      .exec()
      .then((doc) => {
        // update-like
        query._id = doc._id;
        Object.keys(patch).forEach((key) => {
          doc[key] = patch[key];
        });
        return doc.save();
      })
      .then((doc) => {
        expect(doc.content).toEqual(patch.content);
        const update = {_id: query._id, ...patch};
        expect(documentSpy.mock.calls.length).toBe(1);
        expect(documentSpy.mock.calls[0][0]).toEqual({query, update});
        expect(schemaSpy.mock.calls.length).toBe(1);
        expect(schemaSpy.mock.calls[0][0]).toEqual({query, update});
        expect(fieldSpy.mock.calls.length).toBe(1);
        expect(fieldSpy.mock.calls[0][0]).toEqual({
          operator: '$set',
          query,
          update: {_id: query._id, name: update.name}
        });
      });
  });
  it('should properly support document update', () => {
    // Bind events
    const documentSpy = jest.fn();
    Model.on('updated', documentSpy);
    const schemaSpy = jest.fn();
    Model.schema.on('model:updated', schemaSpy);
    const fieldSpy = jest.fn();
    Model.on('updated:name', fieldSpy);
    // Actually patch document
    const query = {};
    const patch = {name: 'TestSave3', content: {foo: 'baz'}};
    return Model.findOne()
      .exec()
      .then((doc) => {
        query._id = doc._id;
        return Model.update(query, patch);
      })
      .then((doc) => {
        expect(doc.ok).toEqual(1);
        expect(doc.n).toEqual(1);
        return Model.findOne({name: 'TestSave3'});
      })
      .then((doc) => {
        expect(doc.content).toEqual(patch.content);
        const update = {_id: query._id, ...patch};
        expect(documentSpy.mock.calls.length).toBe(1);
        expect(documentSpy.mock.calls[0][0]).toEqual({query, update});
        expect(schemaSpy.mock.calls.length).toBe(1);
        expect(schemaSpy.mock.calls[0][0]).toEqual({query, update});
        expect(fieldSpy.mock.calls.length).toBe(1);
        expect(fieldSpy.mock.calls[0][0]).toEqual({
          operator: '$set',
          query,
          update: {_id: query._id, name: update.name}
        });
      });
  });
  describe('ignoredFields option', () => {
    it('should properly support ignored fields while saving one document', () => {
      // Bind events
      const documentSpy = jest.fn();
      Model.on('created', documentSpy);
      const schemaSpy = jest.fn();
      Model.schema.on('model:created', schemaSpy);
      const documentUpdatedSpy = jest.fn();
      Model.on('updated', documentUpdatedSpy);
      const fieldSpy = jest.fn();
      Model.on('updated:count', fieldSpy);
      // Actually create document
      const orig = {name: 'TestSave', content: {foo: 'bar'}, count: 6};
      const patch = {count: 12};
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
          doc.set('count', patch.count);
          return doc.save();
        })
        .then((doc) => {
          expect(fieldSpy.mock.calls.length).toBe(0);
          expect(documentUpdatedSpy.mock.calls.length).toBe(0);
        });
    });
    it('should properly support ignored fields while updating one document', () => {
      // Bind events
      const documentSpy = jest.fn();
      Model.on('updated', documentSpy);
      const schemaSpy = jest.fn();
      Model.schema.on('model:updated', schemaSpy);
      const fieldSpy = jest.fn();
      Model.on('updated:count', fieldSpy);
      // Actually patch document
      const query = {};
      const patch = {count: 6};
      return Model.findOne()
        .exec()
        .then((doc) => {
          query._id = doc._id;
          return Model.update(query, patch);
        })
        .then((res) => {
          expect(res.ok).toEqual(1);
          expect(res.n).toEqual(1);
          return Model.findById(query._id);
        })
        .then((doc) => {
          expect(doc.count).toEqual(patch.count);
          expect(documentSpy.mock.calls.length).toBe(0);
          expect(schemaSpy.mock.calls.length).toBe(0);
          expect(fieldSpy.mock.calls.length).toBe(0);
        });
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
