pouch-model
===========

PouchDB-based model objects for Angular

`$pouchModel` is intended to be a drop-in replacement for the `$resource` service that
comes with Angular's `ngResource` module for building offline-first web applications.
`$pouchModel` also provides a more sophisticated API than `$resource` for defining a
data model using [JSON Schema](http://json-schema.org/) so that business logic that
would typically reside on the server can be relocated to the client.

Getting Started
---------------

Install development dependencies:

```shell
npm install
```

Build for distribution:

```shell
grunt build
```

Example
-------

An example application is included in the `example` directory that demonstrates how
to use `$pouchModel` as a drop-in replacement for `$resource` in a typical Angular
application.

Install required Bower components:

```shell
bower install
```

Start the Express app server:

```shell
grunt serve
```
