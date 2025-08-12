FROM public.ecr.aws/lambda/nodejs:20

# Install Ghostscript on Amazon Linux 2023 base image
RUN microdnf update -y \
    && microdnf install -y ghostscript \
    && microdnf clean all

WORKDIR /var/task

# Copy Lambda handler
COPY lambda.js ./

# Set the Lambda handler (file.export)
CMD ["lambda.handler"]
