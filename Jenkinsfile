pipeline {
    agent any

    environment {
        REGISTRY    = credentials('registry-url')
        BUILD_TAG   = "${env.GIT_BRANCH}-${env.GIT_COMMIT.take(7)}"
        COMPOSE_FILE = 'docker-compose.yml'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            parallel {
                stage('backend') {
                    steps {
                        sh """
                            DOCKER_BUILDKIT=1 docker build \
                              --cache-from ${REGISTRY}/soil-backend:latest \
                              --build-arg BUILDKIT_INLINE_CACHE=1 \
                              -t ${REGISTRY}/soil-backend:${BUILD_TAG} \
                              ./backend
                        """
                    }
                }
                stage('frontend') {
                    steps {
                        sh """
                            DOCKER_BUILDKIT=1 docker build \
                              --cache-from ${REGISTRY}/soil-frontend:latest \
                              --build-arg BUILDKIT_INLINE_CACHE=1 \
                              -t ${REGISTRY}/soil-frontend:${BUILD_TAG} \
                              ./frontend
                        """
                    }
                }
                stage('mqtt-service') {
                    steps {
                        sh """
                            DOCKER_BUILDKIT=1 docker build \
                              --cache-from ${REGISTRY}/soil-mqtt:latest \
                              --build-arg BUILDKIT_INLINE_CACHE=1 \
                              -t ${REGISTRY}/soil-mqtt:${BUILD_TAG} \
                              ./mqtt-service
                        """
                    }
                }
            }
        }

        stage('Push') {
            when { branch 'main' }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'registry-creds',
                    usernameVariable: 'REGISTRY_USER',
                    passwordVariable: 'REGISTRY_PASS'
                )]) {
                    sh 'echo "$REGISTRY_PASS" | docker login ${REGISTRY} -u "$REGISTRY_USER" --password-stdin'
                    sh """
                        docker push ${REGISTRY}/soil-backend:${BUILD_TAG}
                        docker push ${REGISTRY}/soil-frontend:${BUILD_TAG}
                        docker push ${REGISTRY}/soil-mqtt:${BUILD_TAG}

                        docker tag ${REGISTRY}/soil-backend:${BUILD_TAG}  ${REGISTRY}/soil-backend:latest
                        docker tag ${REGISTRY}/soil-frontend:${BUILD_TAG} ${REGISTRY}/soil-frontend:latest
                        docker tag ${REGISTRY}/soil-mqtt:${BUILD_TAG}     ${REGISTRY}/soil-mqtt:latest

                        docker push ${REGISTRY}/soil-backend:latest
                        docker push ${REGISTRY}/soil-frontend:latest
                        docker push ${REGISTRY}/soil-mqtt:latest
                    """
                }
            }
        }

        stage('Deploy') {
            when { branch 'main' }
            steps {
                sshagent(['deploy-key']) {
                    sh """
                        ssh -o StrictHostKeyChecking=no deploy@\${DEPLOY_HOST} '
                            cd /opt/heat-map-soil &&
                            export REGISTRY=${REGISTRY} IMAGE_TAG=${BUILD_TAG} &&
                            docker compose -f docker-compose.yml -f docker-compose.prod.yml pull &&
                            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
                        '
                    """
                }
            }
        }
    }

    post {
        failure {
            mail(
                to: env.NOTIFY_EMAIL,
                subject: "BUILD FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                body: "Branch: ${env.GIT_BRANCH}\nCommit: ${env.GIT_COMMIT}\nDetails: ${env.BUILD_URL}"
            )
        }
        success {
            script {
                if (env.GIT_BRANCH == 'main') {
                    mail(
                        to: env.NOTIFY_EMAIL,
                        subject: "DEPLOYED: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                        body: "Tag: ${BUILD_TAG}\nDetails: ${env.BUILD_URL}"
                    )
                }
            }
        }
        always {
            sh 'docker logout ${REGISTRY} || true'
        }
    }
}
