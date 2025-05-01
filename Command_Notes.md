Run postgres within Docker.
--DOCKER 
docker exec -it fsds_postgres psql -U fsds_user -d fsds_rag

docker-compose down -v
docker-compose up -d



env $(cat .env.super | xargs) npx prisma migrate dev
env $(cat .env.super | xargs) npm run seed