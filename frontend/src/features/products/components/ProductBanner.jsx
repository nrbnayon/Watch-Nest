import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation } from "swiper/modules";
import { Box } from "@mui/material";

// Import Swiper styles
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

export const ProductBanner = ({ images }) => {
  return (
    <div
      style={{
        width: "100%",
        position: "relative",
        height: "70vh",
        backgroundColor: "#f5f5f5",
      }}
    >
      <Swiper
        modules={[Autoplay, Pagination, Navigation]}
        spaceBetween={0}
        slidesPerView={1}
        autoplay={{
          delay: 3000,
          disableOnInteraction: false,
        }}
        pagination={{
          clickable: true,
          type: "bullets",
        }}
        navigation={true}
        className='mySwiper'
        style={{
          "--swiper-navigation-color": "#000",
          "--swiper-pagination-color": "#000",
          height: "100%",
        }}
      >
        {images.map((image, index) => (
          <SwiperSlide
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <Box
              component='img'
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "fit",
                maxHeight: "70vh",
                padding: "0",
              }}
              src={image}
              alt={"Banner Image"}
            />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};
