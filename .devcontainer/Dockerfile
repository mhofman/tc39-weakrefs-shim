FROM node:lts

# Configure apt
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get -y install --no-install-recommends apt-utils 2>&1

RUN apt-get install -y curl apt-transport-https lsb-release

# Verify git and needed tools are installed
RUN apt-get install -y git procps

# Remove outdated yarn from /opt and install via package 
# so it can be easily updated via apt-get upgrade yarn
RUN rm -rf /opt/yarn-* \
    rm -f /usr/local/bin/yarn \
    rm -f /usr/local/bin/yarnpkg \
    && curl -sS https://dl.yarnpkg.com/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/pubkey.gpg | apt-key add - 2>/dev/null \
    && echo "deb https://dl.yarnpkg.com/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/ stable main" | tee /etc/apt/sources.list.d/yarn.list \
    && apt-get update \
    && apt-get -y install --no-install-recommends yarn

# Install Chrome unstable for Karma
RUN curl -sS https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - 2>/dev/null \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome-unstable.list \
    && apt-get update \
    && apt-get -y install --no-install-recommends google-chrome-unstable

# Install libnspr4 for jsshell
# TODO Figure out how to use downloaded lib
RUN apt-get install -y libnspr4

# Install tslint and typescript
RUN npm install -g tslint typescript

# Clean up
RUN apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*
ENV DEBIAN_FRONTEND=dialog

RUN usermod -G audio,video node
USER node
ENV HOME /home/node
ENV INSIDE_DOCKER=1