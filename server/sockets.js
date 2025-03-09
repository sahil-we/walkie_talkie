const activeUsers = {};

module.exports = function(io) {
    io.on('connection', socket => {
        console.log('New user connected:', socket.id);

        socket.on('register', ({ pin }) => {
            activeUsers[pin] = socket.id;
            console.log(`User ${pin} connected`);
        });

        socket.on('call', ({ fromPin, toPin }) => {
            if (activeUsers[toPin]) {
                io.to(activeUsers[toPin]).emit('incomingCall', { fromPin });
            } else {
                socket.emit('userOffline', { message: "User not online" });
            }
        });

        socket.on('disconnect', () => {
            const userPin = Object.keys(activeUsers).find(pin => activeUsers[pin] === socket.id);
            if (userPin) delete activeUsers[userPin];
            console.log(`User ${userPin} disconnected`);
        });
    });
};
