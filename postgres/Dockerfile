FROM postgres:14-alpine

# Install build dependencies (including the correct LLVM version)
RUN apk add --no-cache --virtual .build-deps \
    git \
    build-base \
    clang \
    llvm19 \
    llvm19-libs \
    llvm19-dev \
    postgresql-dev

# Clone and build pgvector
RUN git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install

# Clean up build dependencies
RUN apk del .build-deps

# Remove build artifacts
RUN rm -rf /pgvector
