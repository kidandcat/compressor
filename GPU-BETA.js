// @author Jairo Caro-Accino Viciana <kidandcat@gmail.com>
//
// node --max-old-space-size=8192 app.js compress ../log.log ../pass.xml 5 doctrine.json
//
// node --max-old-space-size=8192 app.js decompress doctrine.json ../pass.xml output.js
//
const fs = require('fs');
const monkeys = require("webmonkeys")();

let obj = {};
let final = [];
let memory = [];
let memory2 = [];
let countertick = 0;
let countertickglobal = 0;
let comparations = 0;
let findings = 0;
let mappings = 0;
let totalCoincidences = 0;
let totalCounter = 0;
let globalStep = 0;
let file2Size = 0;
let counter2 = 0;


if (process.argv[2] == 'compress') {
    compress(process.argv[3], process.argv[4], process.argv[5], (r) => {
        mem = function() {};
        fs.writeFile(process.argv[6], JSON.stringify(r, null, 4));
        console.log('COMPRESSION END!');
        console.log('r', r);
        console.log('f', final);
    });
}

if (process.argv[2] == 'decompress') {
    let json = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    decompress(json, process.argv[4], process.argv[5]);
}


//Functions

function decompress(target, dataSource, name) {
    console.log('Target: ', target);
    console.log('DataSource: ', dataSource);
    console.log('Name: ', name);
    let wstream = fs.createWriteStream(name);
    memory = [];
    let size = fs.statSync(dataSource)["size"];;
    readChunky(dataSource, 1, (chunk) => {
        memory.push({
            chunk: chunk
        });
    }).then(() => {

        let int = setInterval(() => {
            console.log('Size: ', size);
            if (size == memory.length) {
                clearInterval(int);
                target.forEach((d) => {
                    for (let i = 0; i < d.size; i++) {
                        if (memory[d.position + i]) {
                            wstream.write(memory[d.position + i].chunk);
                        }
                    }
                });
                wstream.end();
                mem = function() {};
                console.log('DECOMPRESS END!');
            }
        }, 500);

    });
}

function compress(target, dataSource, step, cb, debug) {
    debug = debug || true;
    final = [];
    memory = [];
    memory2 = [];

    readChunky(target, 1, (chunk) => {
        final.push({
            chunk: chunk,
            got: false
        });
    }).then(() => {
        fusion(target, dataSource, step, debug, cb);
    });
}

function fusion(file1, file2, step, debug, cb) {
    globalStep = step;
    step = parseInt(step);
    mem();
    readChunky(file1, step, (chunk) => {
        memory.push({
            chunk: chunk,
            got: false
        });
    }).then(() => {
        let coincidences = 0;
        let counter = 0;
        set = false;

        file2Size = fs.statSync(file2)["size"];
        readChunky(file2, step, (chunk) => {
            memory2.push({
                chunk: chunk,
                got: false
            });

        }).then(() => {

            memory.forEach((chunk) => {
                //process.nextTick(() => {
                    compare2(chunk.chunk, counter, step, (res) => {
                        totalCounter--;
                        if (res) {
                            coincidences++;
                            totalCoincidences++;
                        }
                    });
                //});
                totalCounter++;
                counter++;
                counter2++;
            });

            let int = setInterval(() => {
                if (totalCounter == (totalCoincidences * (-1))) {
                    clearInterval(int);
                    after(file1, file2, step, debug, cb);
                }
            }, 500);

        });
    });
}

function after(file1, file2, step, debug, cb) {
    memory.forEach((c) => {
        mappings++;
        if (c.got.lock && !final[memory.indexOf(c)].got.lock) {
            final[memory.indexOf(c)] = c;
        }
    });
    memory = [];
    if (step > 1) {
        fusion(file1, file2, --step, debug, cb);
    } else {
        let res = final.map((r) => {
            if (r.got.size) {
                return {
                    index: final.indexOf(r),
                    position: r.got.position,
                    size: r.got.size
                };
            }
        });
        cb(cleanArray(res));
    }
}

function readChunky(file, step, cb, end) {
    var success = function(c) {};
    var error = function(c) {};
    //Promise
    let siz = fs.statSync(file)["size"];
    let cc = 0;
    fs.open(file, 'r', function(err, fd) {
        if (err)
            throw err;
        chunkychunky(fd, step, cb, success, siz, cc);
    });
    //Promise
    return {
        then: function(cb) {
            success = cb;
            return this;
        },
        error: function(cb) {
            error = cb;
            return this;
        }
    };
}

function chunkychunky(fd, step, cb, success, siz, cc) {
    var buffer = new Buffer(step);
    var num = fs.readSync(fd, buffer, 0, step, cc);
    if (num === 0) {
        success();
    } else {
        cb(buffer);
        setImmediate(() => {
            cc++;
            chunkychunky(fd, step, cb, success, siz, cc);
        });
    }
}

function cleanArray(actual) {
    var newArray = new Array();
    for (var i = 0; i < actual.length; i++) {
        if (actual[i]) {
            newArray.push(actual[i]);
        }
    }
    return newArray;
}

function compare(chunk, position, size) {
    comparations++;
    let res = false;
    memory.forEach((c) => {
        let jump = false;
        findings++;
        if (c.chunk.equals(chunk) && !c.got.lock) {
            for (let x = 0; x < size; x++) {
                if (final[memory.indexOf(c) + x] && final[memory.indexOf(c) + x].got.lock) {
                    jump = true;
                }
            }
            if (!jump) {
                c.got = {
                    position: position,
                    size: size,
                    lock: true
                };
                res = true;
                for (let x = 0; x < size; x++) {
                    if (memory[memory.indexOf(c) + x]) {
                        if (!memory[memory.indexOf(c) + x].got) {
                            memory[memory.indexOf(c) + x].got = {
                                lock: true
                            };
                        } else {
                            memory[memory.indexOf(c) + x].got.lock = true;
                        }
                    }
                }
            }
        }
    });
    return res;
}

let set = false;

function compare2(chunk, position, size, cb) {
    comparations++;
    if (!set) {
        let a = [];
        memory2.forEach((aa) => {
            a.push(aa.chunk.toJSON().data);
        });
        set = true;
        monkeys.set("memory", a);
    }
    monkeys.set("chunk", [chunk.toJSON().data]);
    monkeys.set("found", memory2.length);
    monkeys.work(memory2.length, `
      bool gotIt = false;
      if (chunk(0) == memory(i))
        gotIt = true;
      found(i) := gotIt ? float(i) : -1.0;
    `);

    let res = monkeys.get("found").findIndex((e) => {
        if (e >= 0)
            return true
        return false
    });
    let jump = false;
    if (res >= 0 && final[res]) {
        for (let x = 0; x < size; x++) {
            if (final[res + x] && final[res + x].got.lock) {
                jump = true;
            }
        }

        if (!jump) {
            memory[res].got = {
                position: position,
                size: size,
                lock: true
            };
            for (let x = 0; x < size; x++) {
                if (memory[res + x]) {
                    if (!memory[res + x].got) {
                        memory[res + x].got = {
                            lock: true
                        };
                    } else {
                        memory[res + x].got.lock = true;
                    }
                }
            }
            cb(true);
        }
    }
    cb(false);
}

if (process.argv[2] == 'compress') {
    mem(true);
}

function mem(repeat) {
    repeat = repeat || false;
    let me = (Math.floor(process.memoryUsage().rss / 1000 / 1000));
    process.stdout.write('\033c');
    console.log('Memory: ' + me + 'MB' + "\n");
    console.log(`Step: ${globalStep}`);
    console.log(`File2Size: ${file2Size}`);
    console.log(`Final: ${final.length}`);
    console.log(`Memory: ${memory.length}`);
    console.log(`Memory2: ${memory2.length}`);
    console.log(`Comparations: ${comparations}`);
    console.log(`Coincidences: ${totalCoincidences}`);
    console.log(`Findings: ${findings}`);
    console.log(`Counter: ${totalCounter}`);
    console.log(`Counter2: ${counter2}`);
    console.log(`Mappings: ${mappings}`);
    if (repeat) {
        setTimeout(() => {
            mem(true);
        }, 100);
    }
}
