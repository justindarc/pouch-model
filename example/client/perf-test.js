function perfTest(fn, iterations) {
  var result = {
    iterations: []
  };

  var current = 0;
  var total = 0;
  var start, end, time;

  console.log('[perfTest][BEGIN] iterations = ' + iterations);
  step();

  function step() {
    start = performance.now();
    fn.call(this, done);
    if (!fn.length) {
      done();
    }
  }

  function done() {
    end = performance.now();
    time = end - start;
    total += time;

    result.iterations.push(time);

    if (++current < iterations) {
      step();
    } else {
      result.average = total / iterations;
      console.log('[perfTest][END] average = ' + result.average, result);
      return result;
    }
  }

  return result;
}
