FROM node:8
WORKDIR /moving-average
COPY ./package.json .
RUN npm install --only=production
COPY index.js .
CMD node .