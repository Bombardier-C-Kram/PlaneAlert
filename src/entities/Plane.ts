import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {PlaneAlert} from "../PlaneAlert";
import {PlaneEvents} from "../PlaneEvents";
import {GeoUtils} from "../utils/GeoUtils";

@Entity()
export class Plane extends BaseEntity{

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: "varchar", length: 255})
    name!: string;

    @Column({type: "varchar", length: 255})
    icao!: string;

    @Column({type: "varchar", length: 255})
    registration!: string;

    @Column({type: "boolean", default: true})
    active!: boolean;

    @Column({type: "integer", default: 1800})
    refresh_interval!: number;

    @Column({type: "timestamp", nullable: true})
    last_refresh!: Date;

    @Column({type: "timestamp", nullable: true})
    next_refresh!: Date;

    @Column({type: "timestamp", nullable: true})
    last_seen!: Date;

    @Column({type: "boolean", default: true})
    on_ground!: boolean;

    @Column({type: "boolean", default: false})
    live_track!: boolean;

    @Column({type: "integer", nullable: true})
   last_lat!: number;

    @Column({type: "integer", nullable: true})
    last_lng!: number;
    ////////////////////////////////////////////////////////////////

    public async update(){
        const data = await PlaneAlert.trackSource?.getPlaneStatus(this.icao);
        if(data === undefined){
            return;
        }
        if(data !== null) {
            if (data.latitude !== null && data.longitude !== null) {
                this.last_lat = data.latitude * 1E6;
                this.last_lng = data.longitude * 1E6;
                // PlaneAlert.log.debug(this.findNearestAirport());
            }
            if (!data.onGround
                && data.barometricAltitude !== null && data.barometricAltitude < PlaneAlert.config['takeoffAltitudeThreshold']
                && (!this.live_track || data.onGround)) {
                //Plane takeoff
                const nearestAirport = this.findNearestAirport();
                if (nearestAirport?.airport !== null){
                    PlaneAlert.log.info(`Plane ${this.icao} is taking off from ${nearestAirport?.airport['"name"']}`);
                }else{
                    PlaneAlert.log.info(`Plane ${this.icao} is taking off`);
                }

            }
            this.on_ground = data.onGround;
            this.live_track = true;
            this.last_seen = new Date();
        }else{
            this.live_track = false;
        }
        this.last_refresh = new Date();
        this.next_refresh = new Date();
        this.next_refresh.setSeconds(this.next_refresh.getSeconds() + this.refresh_interval);
        this.save();
    }

    private triggerEvent(event: PlaneEvents, data: any){
        PlaneAlert.log.info(`Plane ${this.name} (${this.icao}) trigered  ${event}`);
    }

    private findNearestAirport(){
        if(this.last_lng === null || this.last_lat === null || PlaneAlert.airports === null){
            return null;
        }
        PlaneAlert.log.debug(`Plane ${this.name} (${this.icao}) searching for nearest airport of ${this.last_lat/1E6}/${this.last_lng/1E6}`);
        let min_distance = Number.MAX_SAFE_INTEGER;
        let nearest_airport = null;
        for(const airport of PlaneAlert.airports){
            const distance = GeoUtils.distanceBetweenCoordinates(this.last_lat/1E6, this.last_lng/1E6, airport['"latitude_deg"'], airport['"longitude_deg"']);
            if(distance < min_distance){
                min_distance = distance;
                nearest_airport = airport;
            }
        }
        return {
            airport: nearest_airport,
            distance: min_distance
        };
    }

}
